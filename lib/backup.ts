import { getDb } from "./db.ts";
import { deleteObjectKey, getObject, putObject } from "./storage.ts";

export const WEB_BACKUP_FORMAT = "eventpulse-backup";
export const WEB_BACKUP_VERSION = 1;

type BackupValue = string | number | boolean | null | { $binary: string };
export type BackupTableRows = Record<string, BackupValue>[];
export type WebBackup = {
  format: typeof WEB_BACKUP_FORMAT | "eventpulse-web-backup" | "eventpulse-desktop-backup";
  source?: "web" | "desktop";
  version: typeof WEB_BACKUP_VERSION;
  createdAt: string;
  tables: Record<string, BackupTableRows>;
  files: { key: string; data: string }[];
};

type DbValue = string | number | bigint | Uint8Array | null;

async function readBackupArchive(db: Awaited<ReturnType<typeof getDb>>) {
  const exists = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='eventpulse_backup_archive'").get();
  if (!exists) return {} as Record<string, BackupTableRows>;
  const rows = await db.prepare("SELECT table_name, rows_json FROM eventpulse_backup_archive").all() as { table_name: string; rows_json: string }[];
  const archived: Record<string, BackupTableRows> = {};
  for (const row of rows) {
    try {
      const parsed: unknown = JSON.parse(row.rows_json);
      if (/^[a-zA-Z0-9_]+$/.test(row.table_name) && Array.isArray(parsed)) archived[row.table_name] = parsed as BackupTableRows;
    } catch {
      // Ignore malformed archive entries rather than failing routine backups.
    }
  }
  return archived;
}

function encodeValue(value: unknown): BackupValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return { $binary: Buffer.from(value).toString("base64") };
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  return String(value);
}

function decodeValue(value: BackupValue): DbValue {
  if (value && typeof value === "object" && "$binary" in value) {
    return new Uint8Array(Buffer.from(value.$binary, "base64"));
  }
  return typeof value === "boolean" ? Number(value) : value as DbValue;
}

function decodeTables(tables: Record<string, BackupTableRows>) {
  return Object.fromEntries(Object.entries(tables).map(([table, rows]) => [
    table,
    rows.map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, decodeValue(value)]))),
  ])) as Record<string, Record<string, DbValue>[]>;
}

function storageObjectKey(reference: string): string | null {
  let key = reference;
  if (reference.startsWith("https://")) {
    try {
      const url = new URL(reference);
      if (url.username || url.password || url.search || url.hash || !(url.hostname === "public.blob.vercel-storage.com" || url.hostname.endsWith(".public.blob.vercel-storage.com"))) return null;
      key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return null;
    }
  }
  if (!key.startsWith("uploads/") && !key.startsWith("avatars/")) return null;
  if (key.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) return null;
  return /^[a-zA-Z0-9._/-]+$/.test(key) ? key : null;
}

async function readStoredFile(reference: string, objectKey: string, files: Map<string, string>) {
  try {
    files.set(objectKey, Buffer.from(await getObject(reference)).toString("base64"));
  } catch {
    throw new Error(`Could not read a stored workspace file (${objectKey}).`);
  }
}

export async function createWebBackup(): Promise<WebBackup> {
  const db = await getDb();
  const archivedTables = await readBackupArchive(db);
  const tableNames = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','eventpulse_backup_archive') AND name NOT LIKE 'eventpulse_backup_restore_%' ORDER BY name",
  ).all() as { name: string }[];
  const tables: Record<string, BackupTableRows> = {};
  const files = new Map<string, string>();

  for (const { name } of tableNames) {
    const rows = await db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all() as Record<string, unknown>[];
    tables[name] = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encodeValue(value)])));
    if (name === "event_files") {
      for (const row of rows) {
        const reference = row.storage_key;
        if (typeof reference !== "string" || reference.startsWith("sync-pending:") || reference.startsWith("remote-pending:")) continue;
        const key = storageObjectKey(reference);
        if (key) await readStoredFile(reference, key, files);
      }
    }
    if (name === "users") {
      for (const row of rows) {
        const avatar = row.avatar_url;
        if (typeof avatar !== "string") continue;
        const match = /^\/api\/avatars\/([a-z0-9-]{8,64})\.(png|jpe?g|webp)(?:\?.*)?$/i.exec(avatar);
        if (!match) continue;
        const extension = match[2].toLowerCase() === "jpeg" ? "jpg" : match[2].toLowerCase();
        const key = `avatars/${match[1]}.${extension}`;
        await readStoredFile(key, key, files);
      }
    }
  }

  tables.eventpulse_backup_archive = Object.entries(archivedTables).map(([table_name, rows]) => ({
    table_name,
    rows_json: JSON.stringify(rows),
  }));

  for (const [name, rows] of Object.entries(archivedTables)) {
    if (!(name in tables)) {
      tables[name] = rows;
      continue;
    }
    const schema = await db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; pk: number }[];
    const primaryKeys = schema.filter((column) => column.pk).map((column) => column.name);
    if (!primaryKeys.length) continue;
    const archivedByKey = new Map(rows.map((row) => [primaryKeys.map((key) => JSON.stringify(row[key])).join("|"), row]));
    tables[name] = tables[name].map((row) => {
      const archived = archivedByKey.get(primaryKeys.map((key) => JSON.stringify(row[key])).join("|"));
      if (!archived) return row;
      const extra = Object.fromEntries(Object.entries(archived).filter(([column]) => !schema.some((entry) => entry.name === column)));
      return { ...row, ...extra };
    });
  }

  return {
    format: WEB_BACKUP_FORMAT,
    source: "web",
    version: WEB_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
    files: [...files].map(([key, data]) => ({ key, data })),
  };
}

export function validateWebBackup(value: unknown): value is WebBackup {
  if (!value || typeof value !== "object") return false;
  const backup = value as Partial<WebBackup>;
  if ((backup.format !== WEB_BACKUP_FORMAT && backup.format !== "eventpulse-web-backup" && backup.format !== "eventpulse-desktop-backup") || backup.version !== WEB_BACKUP_VERSION) return false;
  if (!backup.tables || typeof backup.tables !== "object" || Array.isArray(backup.tables) || !Array.isArray(backup.files)) return false;
  const legacyFormat = backup.format;
  if (Object.entries(backup.tables).some(([table, rows]) => !/^[a-zA-Z0-9_]+$/.test(table) || !Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))) return false;
  if (backup.files.some((file) => !file || typeof file.key !== "string" || typeof file.data !== "string")) return false;
  backup.format = WEB_BACKUP_FORMAT;
  if (backup.source !== "web" && backup.source !== "desktop") backup.source = legacyFormat === "eventpulse-web-backup" ? "web" : legacyFormat === "eventpulse-desktop-backup" ? "desktop" : undefined;
  for (const file of backup.files) {
    if (!file || typeof file.key !== "string") return false;
    let key = storageObjectKey(file.key);
    if (!key && /^[a-zA-Z0-9._/-]+$/.test(file.key) && file.key.split("/").every((part) => part && part !== "." && part !== "..")) key = `uploads/${file.key}`;
    if (!key) return false;
    file.key = key;
  }
  if (backup.source === "desktop") {
    backup.files = backup.files.flatMap((file) => {
      if (!file.key.startsWith("uploads/")) return [];
      const size = Buffer.from(file.data, "base64").toString("base64");
      return [{ ...file, data: size }];
    });
    for (const row of backup.tables.users ?? []) {
      if (typeof row.avatar_url === "string" && !row.avatar_url.startsWith("/api/avatars/")) row.avatar_url = null;
    }
  }
  for (const file of backup.files) {
    if (typeof file.data !== "string" || !file.data.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data) || Buffer.from(file.data, "base64").toString("base64") !== file.data) return false;
  }
  for (const row of backup.tables.event_files ?? []) {
    if (typeof row.storage_key !== "string" || row.storage_key.startsWith("sync-pending:") || storageObjectKey(row.storage_key)) continue;
    const normalized = row.storage_key.replace(/\\/g, "/");
    const match = normalized.match(/(?:^|\/)uploads\/(.+)$/i);
    if (!match || match[1].split("/").some((part) => !part || part === "." || part === "..")) return false;
    row.storage_key = `uploads/${match[1]}`;
  }
  for (const [table, rows] of Object.entries(backup.tables)) {
    if (!/^[a-zA-Z0-9_]+$/.test(table) || !Array.isArray(rows)) return false;
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return false;
    for (const row of rows) {
      for (const [column, entry] of Object.entries(row)) {
        if (!/^[a-zA-Z0-9_]+$/.test(column)) return false;
        if (entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean" && !(typeof entry === "object" && "$binary" in entry && typeof entry.$binary === "string")) return false;
      }
    }
  }
  const referencedFiles = new Set<string>();
  for (const row of backup.tables.event_files ?? []) {
    if (typeof row.storage_key !== "string") return false;
    if (row.storage_key.startsWith("sync-pending:")) continue;
    const key = storageObjectKey(row.storage_key);
    if (!key) return false;
    referencedFiles.add(key);
  }
  for (const row of backup.tables.users ?? []) {
    if (typeof row.avatar_url !== "string") continue;
    const match = /^\/api\/avatars\/([a-z0-9-]{8,64})\.(png|jpe?g|webp)(?:\?.*)?$/i.exec(row.avatar_url);
    if (match) referencedFiles.add(`avatars/${match[1]}.${match[2].toLowerCase() === "jpeg" ? "jpg" : match[2].toLowerCase()}`);
  }
  const fileKeys = new Set<string>();
  for (const key of referencedFiles) if (!backup.files.some((file) => file?.key === key)) return false;
  return backup.files.every((file) => {
    if (!file || typeof file.key !== "string" || typeof file.data !== "string" || !file.data.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data) || Buffer.from(file.data, "base64").toString("base64") !== file.data) return false;
    const key = storageObjectKey(file.key);
    if (!key || !referencedFiles.has(key) || fileKeys.has(key)) return false;
    fileKeys.add(key);
    return true;
  });
}

export async function restoreWebBackup(backup: WebBackup) {
  const { tables: targetTables, archive } = await adaptBackupTablesForWeb(backup.tables);
  await validateBackupSchema(targetTables);
  const previous = await createWebBackup();
  const newObjects: string[] = [];
  const restoredReferences = new Map<string, string>();
  try {
    for (const file of backup.files) {
      const key = storageObjectKey(file.key);
      if (!key) throw new Error("This backup contains an invalid file reference.");
      newObjects.push(key);
      const reference = await putObject({ key, bytes: new Uint8Array(Buffer.from(file.data, "base64")), contentType: "application/octet-stream", allowOverwrite: true });
      restoredReferences.set(key, reference);
    }

    const tables = decodeTables(targetTables);
    for (const row of tables.event_files ?? []) {
      const reference = row.storage_key;
      if (typeof reference === "string") {
        const key = storageObjectKey(reference);
        if (key && restoredReferences.has(key)) row.storage_key = restoredReferences.get(key)!;
      }
    }
    for (const row of tables.users ?? []) {
      const avatar = row.avatar_url;
      if (typeof avatar !== "string") continue;
      const match = /^\/api\/avatars\/([a-z0-9-]{8,64})\.(png|jpe?g|webp)(?:\?.*)?$/i.exec(avatar);
      if (match) {
        const extension = match[2].toLowerCase() === "jpeg" ? "jpg" : match[2].toLowerCase();
        if (!restoredReferences.has(`avatars/${match[1]}.${extension}`)) row.avatar_url = null;
      }
    }
    await replaceTables(tables, archive);
  } catch (error) {
    const previousKeys = new Set(previous.files.map((file) => storageObjectKey(file.key)));
    for (const key of newObjects) {
      if (!previousKeys.has(key)) await deleteObjectKey(key);
    }
    for (const file of previous.files) {
      const key = storageObjectKey(file.key);
      if (key) {
        await putObject({ key, bytes: new Uint8Array(Buffer.from(file.data, "base64")), contentType: "application/octet-stream", allowOverwrite: true }).catch(() => {});
      }
    }
    throw error;
  }

  const restoredKeys = new Set(backup.files.map((file) => storageObjectKey(file.key)));
  for (const file of previous.files) {
    const key = storageObjectKey(file.key);
    if (key && !restoredKeys.has(key)) await deleteObjectKey(key);
  }
}

async function adaptBackupTablesForWeb(sourceTables: Record<string, BackupTableRows>) {
  const db = await getDb();
  const names = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','eventpulse_backup_archive') AND name NOT LIKE 'eventpulse_backup_restore_%' ORDER BY name",
  ).all() as { name: string }[];
  const adapted: Record<string, BackupTableRows> = {};
  const archive: Record<string, BackupTableRows> = {};
  const available = new Set(names.map(({ name }) => name));
  for (const [name, rows] of Object.entries(sourceTables)) {
    if (name === "eventpulse_backup_archive") {
      for (const entry of rows) {
        if (typeof entry.table_name !== "string" || typeof entry.rows_json !== "string") continue;
        try {
          const parsed: unknown = JSON.parse(entry.rows_json);
          if (/^[a-zA-Z0-9_]+$/.test(entry.table_name) && Array.isArray(parsed)) archive[entry.table_name] = parsed as BackupTableRows;
        } catch {
          throw new Error("This backup contains invalid archived database data.");
        }
      }
    } else if (!available.has(name) && !name.startsWith("sqlite_")) archive[name] = rows;
  }
  for (const { name } of names) {
    const sourceRows = sourceTables[name] ?? [];
    if (!Array.isArray(sourceRows)) throw new Error(`This backup contains an invalid ${name} table.`);
    const schema = await db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; notnull: number; dflt_value: unknown; pk: number }[];
    const columns = new Set(schema.map((column) => column.name));
    if (sourceRows.some((row) => Object.keys(row).some((column) => !columns.has(column)))) archive[name] = sourceRows;
    adapted[name] = sourceRows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`This backup contains an invalid row in ${name}.`);
      const clean = Object.fromEntries(Object.entries(row).filter(([column]) => columns.has(column)));
      const missing = schema.find((column) => column.notnull && column.dflt_value === null && !column.pk && !(column.name in clean));
      if (missing) throw new Error(`This backup is missing required ${name}.${missing.name} data.`);
      return clean;
    });
  }
  if (!adapted.users?.length) throw new Error("This backup does not contain any workspace users.");
  return { tables: adapted, archive };
}

async function validateBackupSchema(tables: Record<string, BackupTableRows>) {
  const db = await getDb();
  const names = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','eventpulse_backup_archive') AND name NOT LIKE 'eventpulse_backup_restore_%' ORDER BY name",
  ).all() as { name: string }[];
  const available = new Set(names.map(({ name }) => name));
  const supplied = new Set(Object.keys(tables));
  if ([...available].some((name) => !supplied.has(name))) throw new Error("This backup is incomplete and is missing tables from this workspace.");
  const unknown = [...supplied].filter((name) => !available.has(name));
  if (unknown.length) throw new Error(`This backup contains tables not supported by this app version: ${unknown.join(", ")}.`);
  if (!tables.users?.length) throw new Error("This backup does not contain any workspace users.");
  for (const [name, rows] of Object.entries(tables)) {
    const schema = await db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
    const columns = new Set(schema.map((column) => column.name));
    if (rows.some((row) => Object.keys(row).some((column) => !columns.has(column)))) {
      throw new Error(`This backup contains unsupported columns in ${name}.`);
    }
  }
}

async function replaceTables(tables: Record<string, Record<string, DbValue>[]>, archive: Record<string, BackupTableRows>) {
  const db = await getDb();
  const names = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','eventpulse_backup_archive') AND name NOT LIKE 'eventpulse_backup_restore_%' ORDER BY name",
  ).all() as { name: string }[];
  const available = new Set(names.map(({ name }) => name));
  const dependencies = new Map<string, string[]>();
  for (const { name } of names) {
    const references = await db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as { table: string }[];
    dependencies.set(name, references.map(({ table }) => table).filter((table) => available.has(table)));
  }
  const ordered: string[] = [];
  const visited = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    for (const parent of dependencies.get(name) ?? []) visit(parent);
    ordered.push(name);
  }
  for (const { name } of names) visit(name);

  const transaction = await db.transaction();
  try {
    for (const name of ordered.slice().reverse()) await transaction.prepare(`DELETE FROM "${name}"`).run();
    for (const name of ordered) {
      for (const row of tables[name] ?? []) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const sql = `INSERT INTO "${name}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
        await transaction.prepare(sql).run(...columns.map((column) => row[column]));
      }
    }
    await transaction.prepare("CREATE TABLE IF NOT EXISTS eventpulse_backup_archive (table_name TEXT PRIMARY KEY, rows_json TEXT NOT NULL)").run();
    await transaction.prepare("DELETE FROM eventpulse_backup_archive").run();
    for (const [name, rows] of Object.entries(archive)) {
      await transaction.prepare("INSERT INTO eventpulse_backup_archive(table_name,rows_json) VALUES (?,?)").run(name, JSON.stringify(rows));
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}
