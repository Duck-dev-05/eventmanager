import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session-cookie";

export const runtime = "nodejs";

const MAX_CHUNK_CHARS = 400_000;
const MAX_CHUNKS_PER_FILE = 100;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to restore a backup." }, { status: 401 });
  if (user.workspaceRole !== "owner") return NextResponse.json({ error: "Only the workspace owner can restore a full backup." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The backup attachment chunk could not be read." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid backup attachment chunk." }, { status: 400 });
  const value = body as Record<string, unknown>;
  const restoreId = value.restoreId;
  const key = value.key;
  const index = value.index;
  const count = value.count;
  const data = value.data;
  if (typeof restoreId !== "string" || !/^[a-f0-9-]{36}$/i.test(restoreId)
    || typeof key !== "string" || !/^(uploads|avatars)\/[a-zA-Z0-9._/-]+$/.test(key)
    || key.split("/").some((part) => !part || part === "." || part === "..")
    || !Number.isInteger(index) || !Number.isInteger(count)
    || (index as number) < 0 || (count as number) < 1 || (count as number) > MAX_CHUNKS_PER_FILE || (index as number) >= (count as number)
    || typeof data !== "string" || data.length > MAX_CHUNK_CHARS || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    return NextResponse.json({ error: "The backup contains an invalid attachment chunk." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await db.exec(`CREATE TABLE IF NOT EXISTS eventpulse_backup_restore_chunks (
      restore_id TEXT NOT NULL,
      file_key TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (restore_id,file_key,chunk_index)
    )`);
    await db.prepare("DELETE FROM eventpulse_backup_restore_chunks WHERE created_at < ?").run(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const existing = await db.prepare(`SELECT chunk_count FROM eventpulse_backup_restore_chunks
      WHERE restore_id=? AND file_key=? LIMIT 1`).get(restoreId, key) as { chunk_count: number } | undefined;
    if (existing && existing.chunk_count !== count) return NextResponse.json({ error: "The backup contains inconsistent attachment chunks." }, { status: 400 });
    await db.prepare(`INSERT INTO eventpulse_backup_restore_chunks
      (restore_id,file_key,chunk_index,chunk_count,data,created_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(restore_id,file_key,chunk_index) DO UPDATE SET chunk_count=excluded.chunk_count,data=excluded.data,created_at=excluded.created_at`)
      .run(restoreId, key, index as number, count as number, data, new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Backup chunk upload failed:", error);
    return NextResponse.json({ error: "Could not stage a backup attachment." }, { status: 500 });
  }
}
