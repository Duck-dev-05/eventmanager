import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { restoreWebBackup, validateWebBackup } from "@/lib/backup";
import { getSessionUser } from "@/lib/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to restore a backup." }, { status: 401 });
  if (user.workspaceRole !== "owner") return NextResponse.json({ error: "Only the workspace owner can restore a full backup." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid EventPulse backup file." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Choose a valid EventPulse backup file." }, { status: 400 });
  const value = body as Record<string, unknown>;
  const { backup: candidate } = value;
  if (!candidate || typeof candidate !== "object") {
    return NextResponse.json({ error: "Choose a valid EventPulse backup file." }, { status: 400 });
  }
  const restoreId = typeof value.restoreId === "string" && /^[a-f0-9-]{36}$/i.test(value.restoreId)
    ? value.restoreId
    : randomUUID();
  const attachmentLengths = value.attachmentLengths && typeof value.attachmentLengths === "object"
    ? value.attachmentLengths as Record<string, unknown>
    : {};

  const backup = candidate as Parameters<typeof restoreWebBackup>[0];
  const restoredFiles = (backup as { files?: unknown }).files;
  if (!Array.isArray(restoredFiles)) return NextResponse.json({ error: "This backup does not contain an attachment list." }, { status: 400 });
  const db = await getDb();
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS eventpulse_backup_restore_chunks (
      restore_id TEXT NOT NULL,
      file_key TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (restore_id,file_key,chunk_index)
    )`);
    for (const item of restoredFiles) {
      if (!item || typeof item !== "object" || typeof item.key !== "string" || typeof item.data !== "string") {
        throw new Error("This backup contains an invalid attachment.");
      }
      if (item.data.length > 0 && item.data.length <= 400_000) continue;
      const expectedLength = attachmentLengths[item.key];
      if (expectedLength === undefined && item.data.length === 0) continue;
      if (!Number.isSafeInteger(expectedLength) || (expectedLength as number) <= 0 || (expectedLength as number) > 40_000_000) {
        throw new Error("This backup contains invalid attachment length information.");
      }
      const expectedCount = Math.ceil((expectedLength as number) / 400_000);
      const chunks = await db.prepare(`SELECT chunk_index,chunk_count,data FROM eventpulse_backup_restore_chunks
        WHERE restore_id=? AND file_key=? ORDER BY chunk_index`).all(restoreId, item.key) as { chunk_index: number; chunk_count: number; data: string }[];
      if (chunks.length !== expectedCount || chunks.length !== chunks[0]?.chunk_count || chunks.some((chunk, index) => chunk.chunk_index !== index || chunk.chunk_count !== expectedCount)) {
        throw new Error("One or more attachment uploads are incomplete. Please retry the restore.");
      }
      const data = chunks.map((chunk) => chunk.data).join("");
      if (data.length !== expectedLength) throw new Error("An uploaded attachment did not match the backup.");
      item.data = data;
    }

    if (!validateWebBackup(backup)) throw new Error("This is not a valid or supported EventPulse website backup.");
    await restoreWebBackup(backup);
    await db.prepare("DELETE FROM eventpulse_backup_restore_chunks WHERE restore_id=?").run(restoreId);
    return NextResponse.json({ success: true });
  } catch (error) {
    await db.prepare("DELETE FROM eventpulse_backup_restore_chunks WHERE restore_id=?").run(restoreId).catch(() => {});
    console.error("Backup restore completion failed:", error);
    const message = error instanceof Error ? error.message : "The backup could not be restored.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
