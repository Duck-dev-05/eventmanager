#!/usr/bin/env node
/**
 * Restores a JSON dump created by `npm run backup` into the database.
 *
 *   npm run restore -- backups/<timestamp> --yes
 *
 * Warning: this REPLACES everything currently in the target database. The
 * schema is rebuilt from the app's migrations, then rows are reinserted.
 * Uploaded files are restored into local storage only when object storage is
 * not configured; blob-stored files cannot be restored by this script.
 */
import { cpSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { migrations } from "../lib/db-migrations.ts";

const [, , sourceArg, ...flags] = process.argv;

if (!sourceArg) {
  console.error("Usage: npm run restore -- backups/<timestamp> --yes");
  process.exit(1);
}

if (!flags.includes("--yes")) {
  console.error("Refusing to overwrite live data without --yes.");
  process.exit(1);
}

const dumpFile = path.join(path.resolve(sourceArg), "eventpulse-dump.json");
if (!existsSync(dumpFile)) {
  console.error(`No eventpulse-dump.json inside ${path.resolve(sourceArg)}`);
  process.exit(1);
}

const databaseUrl =
  process.env.LIBSQL_URL?.trim() ||
  `file:${path.join(
    process.env.DATA_DIR?.trim()
      ? path.resolve(process.env.DATA_DIR.trim())
      : path.join(process.cwd(), "data"),
    "eventpulse.db",
  ).replace(/\\/g, "/")}`;

const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim();

const db = authToken
  ? createClient({ url: databaseUrl, authToken })
  : createClient({ url: databaseUrl });

const dump = JSON.parse(readFileSync(dumpFile, "utf8"));
const tables = Object.keys(dump.tables ?? {});

if (tables.length === 0) {
  console.error("The dump contains no tables.");
  process.exit(1);
}

// Drop everything, then rebuild the schema from the app's migrations.
await db.executeMultiple("PRAGMA foreign_keys = OFF");
await db.executeMultiple(
  (await db.execute(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )).rows
    .flatMap((row) => [`DROP TABLE IF EXISTS "${row.name}"`])
    .join(";\n"),
);

await db.execute({ sql: "PRAGMA user_version", args: [] });
for (let version = 0; version < migrations.length; version++) {
  await db.executeMultiple(
    `BEGIN; ${migrations[version]}; PRAGMA user_version = ${version + 1}; COMMIT;`,
  );
}

for (const table of tables) {
  const rows = dump.tables[table];
  if (rows.length === 0) continue;

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR IGNORE INTO "${table}" (${columns
    .map((column) => `"${column}"`)
    .join(", ")}) VALUES (${placeholders})`;

  await db.executeMultiple("BEGIN");
  try {
    for (const row of rows) {
      await db.execute({
        sql,
        args: columns.map((column) => row[column] ?? null),
      });
    }
    await db.executeMultiple("COMMIT");
  } catch (error) {
    await db.executeMultiple("ROLLBACK").catch(() => {});
    throw error;
  }
}

await db.executeMultiple("PRAGMA foreign_keys = ON");

// Same guarantee as the app: the first account administers the workspace.
const ownerResult = await db.execute(
  "SELECT 1 FROM users WHERE workspace_role = 'owner' LIMIT 1",
);
if (ownerResult.rows.length === 0) {
  const first = await db.execute(
    "SELECT id FROM users ORDER BY created_at ASC LIMIT 1",
  );
  const firstId = first.rows[0]?.id;
  if (firstId) {
    await db.execute({
      sql: "UPDATE users SET workspace_role = 'owner' WHERE id = ?",
      args: [firstId],
    });
  }
}

// Local uploads copy back only in local-storage mode.
const localUploadsSource = path.join(path.resolve(sourceArg), "storage");
const dataDir = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(process.cwd(), "data");
if (!process.env.BLOB_READ_WRITE_TOKEN && existsSync(localUploadsSource)) {
  cpSync(localUploadsSource, path.join(dataDir, "storage"), { recursive: true });
}

console.log(
  `Restored ${tables.length} table(s) from ${path.resolve(sourceArg)} into ${databaseUrl.startsWith("file:") ? databaseUrl : "the hosted database"}.`,
);
await db.close();
