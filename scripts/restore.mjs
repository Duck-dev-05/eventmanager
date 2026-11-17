#!/usr/bin/env node
/**
 * Restores a backup created by `npm run backup`.
 *
 *   npm run restore -- backups/<timestamp> --yes
 *
 * Stop the app first: this replaces the live database file and uploads.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const [, , sourceArg, ...flags] = process.argv;

if (!sourceArg) {
  console.error("Usage: npm run restore -- backups/<timestamp> --yes");
  process.exit(1);
}

if (!flags.includes("--yes")) {
  console.error("Refusing to overwrite live data without --yes. Stop the app first.");
  process.exit(1);
}

const source = path.resolve(sourceArg);
const backupDb = path.join(source, "eventpulse.db");

if (!existsSync(backupDb)) {
  console.error(`No eventpulse.db inside ${source}`);
  process.exit(1);
}

const configured = process.env.DATA_DIR?.trim();
const dataDir = configured ? path.resolve(configured) : path.join(process.cwd(), "data");

for (const suffix of ["eventpulse.db-wal", "eventpulse.db-shm"]) {
  const stale = path.join(dataDir, suffix);
  if (existsSync(stale)) rmSync(stale);
}

cpSync(backupDb, path.join(dataDir, "eventpulse.db"));

const backupUploads = path.join(source, "uploads");
if (existsSync(backupUploads)) {
  cpSync(backupUploads, path.join(dataDir, "uploads"), { recursive: true });
}

console.log(`Restored ${source} into ${dataDir}`);
console.log("Start the app again (npm run dev) to pick up the restored data.");
