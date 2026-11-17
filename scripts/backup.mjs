#!/usr/bin/env node
/**
 * Copies the live SQLite database and uploads into backups/<timestamp>/.
 *
 * The database is written with SQLite's VACUUM INTO, which produces a
 * consistent single-file copy even while the app is running in WAL mode.
 *
 *   npm run backup
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function dataDirectory() {
  const configured = process.env.DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data");
}

function sqlPath(value) {
  return value.replace(/\\/g, "/").replace(/'/g, "''");
}

const dataDir = dataDirectory();
const databaseFile = path.join(dataDir, "eventpulse.db");

if (!existsSync(databaseFile)) {
  console.error(`No database found at ${databaseFile}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(process.cwd(), "backups", stamp);
mkdirSync(outputDir, { recursive: true });

const backupFile = path.join(outputDir, "eventpulse.db");
const db = new DatabaseSync(databaseFile);
try {
  db.exec(`VACUUM INTO '${sqlPath(backupFile)}'`);
} finally {
  db.close();
}

const uploadsDir = path.join(dataDir, "uploads");
if (existsSync(uploadsDir)) {
  cpSync(uploadsDir, path.join(outputDir, "uploads"), { recursive: true });
}

console.log(`Backup written to ${outputDir}`);
console.log("Restore with: npm run restore -- backups/<timestamp> --yes");
