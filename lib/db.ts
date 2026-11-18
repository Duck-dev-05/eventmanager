import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client, type InArgs, type InValue } from "@libsql/client";
import { migrations } from "./db-migrations.ts";

/**
 * Root for local files: the legacy users.json import and the local-storage
 * fallback used when no object-storage token is configured. Set DATA_DIR to
 * keep them on a mounted volume instead of process.cwd()/data.
 */
const DATA_DIRECTORY = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(process.cwd(), "data");

export function dataDirectory() {
  return DATA_DIRECTORY;
}

function localDatabaseFile() {
  return path.join(DATA_DIRECTORY, "eventpulse.db");
}
export type SqlArg = string | number | bigint | Uint8Array | null;

export type RunResult = {
  changes: number;
  lastInsertRowid: number | null;
};

export type Statement = {
  run(...args: SqlArg[]): Promise<RunResult>;
  get<T>(...args: SqlArg[]): Promise<T | undefined>;
  all<T>(...args: SqlArg[]): Promise<T[]>;
};

export type Transaction = {
  prepare(sql: string): Statement;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

export type Db = {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  batch(statements: { sql: string; args?: SqlArg[] }[]): Promise<RunResult[]>;
  transaction(): Promise<Transaction>;
};


type LegacyUser = {
  id?: string;
  name?: string;
  email?: string;
  createdAt?: string;
  provider?: string;
  passwordHash?: string;
  googleSub?: string;
  avatarUrl?: string;
};

function toRunResult(result: { rowsAffected: number; lastInsertRowid?: bigint | number | null }): RunResult {
  return {
    changes: result.rowsAffected,
    lastInsertRowid:
      result.lastInsertRowid === null || result.lastInsertRowid === undefined
        ? null
        : Number(result.lastInsertRowid),
  };
}

type SqlExecutor = (
  sql: string,
  args?: InValue[],
) => Promise<{
  rowsAffected: number;
  lastInsertRowid?: bigint | number | null;
  rows: unknown[];
}>;

function toStatement(execute: SqlExecutor, sql: string): Statement {
  return {
    async run(...args: SqlArg[]) {
      const result = await execute(sql, args as InValue[]);
      return toRunResult(result);
    },
    async get<T>(...args: SqlArg[]) {
      const result = await execute(sql, args as InValue[]);
      return result.rows[0] as T | undefined;
    },
    async all<T>(...args: SqlArg[]) {
      const result = await execute(sql, args as InValue[]);
      return result.rows as T[];
    },
  };
}

function toDb(client: Client): Db {
  return {
    prepare(sql: string): Statement {
      return toStatement(
        (query, args) => client.execute(query, args) as ReturnType<SqlExecutor>,
        sql,
      );
    },
    exec(sql: string) {
      return client.executeMultiple(sql);
    },
    async batch(statements) {
      const results = await client.batch(
        statements.map((item) => ({
          sql: item.sql,
          args: (item.args ?? []) as InValue[],
        })),
        "write",
      );
      return results.map(toRunResult);
    },
    async transaction(): Promise<Transaction> {
      const txn = await client.transaction("write");
      return {
        prepare(sql: string): Statement {
          return toStatement(
            (query, args) =>
              txn.execute({
                sql: query,
                args: (args ?? []) as InArgs,
              }) as ReturnType<SqlExecutor>,
            sql,
          );
        },
        commit() {
          return txn.commit();
        },
        rollback() {
          return txn.rollback();
        },
      };
    },
  };
}

/**
 * Hosted libSQL (Turso) rejects writes to `PRAGMA user_version`, so the version
 * is mirrored in this table as well. Local file databases keep both in sync.
 */
const SCHEMA_VERSION_TABLE = "schema_migrations";

async function readSchemaVersion(client: Client): Promise<number> {
  let pragmaVersion = 0;
  try {
    const result = await client.execute("PRAGMA user_version");
    pragmaVersion = Number(
      (result.rows[0] as { user_version?: number } | undefined)?.user_version ?? 0,
    );
  } catch {
    // Hosted databases may refuse this read; the table below is authoritative.
  }

  let tableVersion = 0;
  try {
    const result = await client.execute(
      `SELECT version FROM ${SCHEMA_VERSION_TABLE} WHERE id = 1`,
    );
    tableVersion = Number(
      (result.rows[0] as { version?: number } | undefined)?.version ?? 0,
    );
  } catch {
    // The table does not exist until the first migration finishes.
  }

  return Math.max(pragmaVersion, tableVersion);
}

async function writeSchemaVersion(client: Client, version: number) {
  await client.execute(`CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    )`);
  await client.execute({
    sql: `INSERT INTO ${SCHEMA_VERSION_TABLE} (id, version) VALUES (1, ?)
      ON CONFLICT (id) DO UPDATE SET version = excluded.version`,
    args: [version],
  });

  // Best effort: the local file database keeps the pragma too, hosted ones
  // reject the statement and rely on the table.
  await client.execute(`PRAGMA user_version = ${version}`).catch(() => {});
}

async function migrate(client: Client) {
  const currentVersion = await readSchemaVersion(client);

  for (let version = currentVersion; version < migrations.length; version++) {
    try {
      await client.executeMultiple(`BEGIN; ${migrations[version]}; COMMIT;`);
    } catch (error) {
      await client.executeMultiple("ROLLBACK;").catch(() => {});
      throw error;
    }

    await writeSchemaVersion(client, version + 1);
  }
}

async function importLegacyJson(client: Client) {
  const legacyFile = path.join(DATA_DIRECTORY, "users.json");
  if (!existsSync(legacyFile)) return;

  const countResult = await client.execute("SELECT COUNT(*) AS count FROM users");
  const count = Number(
    (countResult.rows[0] as { count?: number } | undefined)?.count ?? 0,
  );
  if (count > 0) return;

  let users: LegacyUser[] = [];
  try {
    const parsed = JSON.parse(readFileSync(legacyFile, "utf8"));
    if (Array.isArray(parsed)) users = parsed as LegacyUser[];
  } catch {
    return;
  }

  const insertSql = `INSERT OR IGNORE INTO users
      (id, name, email, provider, password_hash, google_sub, avatar_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  // A batch is one atomic write: hosted libSQL cannot keep a transaction open
  // across separate requests, so `BEGIN`/`COMMIT` spread over calls fails there.
  const statements = users
    .filter((user): user is LegacyUser & { email: string } => Boolean(user?.email))
    .map((user) => ({
      sql: insertSql,
      args: [
        user.id ?? randomUUID(),
        user.name ?? user.email.split("@")[0],
        user.email.toLowerCase(),
        user.provider ?? "password",
        user.passwordHash ?? null,
        user.googleSub ?? null,
        user.avatarUrl ?? null,
        user.createdAt ?? new Date().toISOString(),
      ] as InValue[],
    }));

  if (statements.length > 0) await client.batch(statements, "write");
}

/** Guarantees somebody can administer the workspace, even on an imported DB. */
async function ensureWorkspaceOwner(client: Client) {
  const owner = await client.execute(
    "SELECT 1 FROM users WHERE workspace_role = 'owner' LIMIT 1",
  );
  if (owner.rows.length > 0) return;

  const first = await client.execute(
    "SELECT id FROM users ORDER BY created_at ASC LIMIT 1",
  );
  const firstId = (first.rows[0] as { id?: string } | undefined)?.id;
  if (!firstId) return;

  await client.execute({
    sql: "UPDATE users SET workspace_role = 'owner' WHERE id = ?",
    args: [firstId],
  });
}

function createClientInstance(): Client {
  const url = process.env.LIBSQL_URL?.trim() || `file:${localDatabaseFile().replace(/\\/g, "/")}`;

  if (url.startsWith("file:")) {
    mkdirSync(DATA_DIRECTORY, { recursive: true });
    return createClient({ url });
  }

  const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim();
  return createClient(authToken ? { url, authToken } : { url });
}

async function initializeDatabase(client: Client) {
  if (process.env.LIBSQL_URL?.trim()?.startsWith("file:")) {
    // Local dev/test databases use WAL; the hosted libSQL service manages it.
    await client.execute("PRAGMA journal_mode = WAL").catch(() => {});
  }
  await client.execute("PRAGMA foreign_keys = ON").catch(() => {});

  await migrate(client);
  await importLegacyJson(client);
  await ensureWorkspaceOwner(client);
}

const globalForDatabase = globalThis as unknown as {
  eventpulseClient?: Client;
  eventpulseInit?: Promise<void>;
};

/**
 * Opens (once) and returns the database adapter. The SQL stays SQLite dialect;
 * point LIBSQL_URL at a hosted libSQL/Turso database on Vercel, or leave it
 * unset to use a local file for development and tests.
 */
export async function getDb(): Promise<Db> {
  const client = (globalForDatabase.eventpulseClient ??= createClientInstance());

  globalForDatabase.eventpulseInit ??= initializeDatabase(client).catch(
    (error) => {
      // Allow a retry on the next request instead of caching the failure.
      globalForDatabase.eventpulseInit = undefined;
      throw error;
    },
  );
  await globalForDatabase.eventpulseInit;

  return toDb(client);
}
