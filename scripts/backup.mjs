#!/usr/bin/env node
/**
 * Exports the database into backups/<timestamp>/ as a portable JSON dump.
 *
 * Works against both a local file database and a hosted libSQL/Turso
 * database (LIBSQL_URL + LIBSQL_AUTH_TOKEN). Uploaded event files live in
 * object storage (Vercel Blob) when BLOB_READ_WRITE_TOKEN is set and are not
 * part of this dump; without the token they are copied from data/storage.
 *
 *   npm run backup
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(process.cwd(), "backups", stamp);
mkdirSync(outputDir, { recursive: true });

const tablesResult = await db.execute(
  `SELECT name FROM sqlite_master
   WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
   ORDER BY name`,
);

const dump = { exportedAt: new Date().toISOString(), tables: {} };

for (const { name } of tablesResult.rows) {
  const rows = await db.execute(`SELECT * FROM "${name}"`);
  dump.tables[name] = rows.rows;
}

writeFileSync(
  path.join(outputDir, "eventpulse-dump.json"),
  JSON.stringify(dump),
);

// Uploaded files are only local when object storage is not configured.
const localUploads = path.join(
  process.env.DATA_DIR?.trim() ? path.resolve(process.env.DATA_DIR.trim()) : path.join(process.cwd(), "data"),
  "storage",
);
if (!process.env.BLOB_READ_WRITE_TOKEN && existsSync(localUploads)) {
  cpSync(localUploads, path.join(outputDir, "storage"), { recursive: true });
}

console.log(`Backup written to ${outputDir}`);
console.log("Restore with: npm run restore -- backups/<timestamp> --yes");
await db.close();
