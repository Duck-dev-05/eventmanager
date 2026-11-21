import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteObject, getObjectRange, putObject } from "@/lib/storage";
import { authenticateSyncRequest } from "@/lib/sync";
import { getEventRole } from "@/lib/events";
import { rolePermissions } from "@/lib/roles";
import { MAX_FILE_BYTES } from "@/lib/file-types";

const CHUNK_BYTES = 256 * 1024;

type Params = { params: Promise<{ fileId: string }> };

async function accessibleFile(fileId: string, userId: string) {
  return await (await getDb()).prepare(
    `SELECT f.id,f.event_id,f.name,f.mime_type,f.size_bytes,f.storage_key,f.updated_at
     FROM event_files f JOIN events e ON e.id=f.event_id
     WHERE f.id=? AND (e.owner_id=? OR EXISTS (
       SELECT 1 FROM event_members em WHERE em.event_id=e.id AND em.user_id=? AND em.status='accepted'
     ))`,
  ).get(fileId, userId, userId) as {
    id: string; event_id: string; name: string; mime_type: string;
    size_bytes: number; storage_key: string; updated_at: string;
  } | undefined;
}

export async function GET(request: Request, { params }: Params) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token." }, { status: 401 });
  const { fileId } = await params;
  const file = await accessibleFile(fileId, device.userId);
  if (!file || file.storage_key.startsWith("sync-pending:")) {
    return NextResponse.json({ error: "File is not available yet." }, { status: 404 });
  }
  const url = new URL(request.url);
  const index = Number(url.searchParams.get("index"));
  const requestedUpdatedAt = url.searchParams.get("updatedAt");
  if (!requestedUpdatedAt || Number.isNaN(Date.parse(requestedUpdatedAt))) return NextResponse.json({ error: "A valid file version is required." }, { status: 400 });
  if (new Date(requestedUpdatedAt).toISOString() !== file.updated_at) return NextResponse.json({ error: "The file changed; refresh sync metadata." }, { status: 409 });
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Invalid file chunk." }, { status: 400 });
  try {
    const start = index * CHUNK_BYTES;
    if (start >= file.size_bytes) return NextResponse.json({ error: "File chunk not found." }, { status: 404 });
    const chunk = await getObjectRange(file.storage_key, start, Math.min(CHUNK_BYTES, file.size_bytes - start));
    return new NextResponse(new Uint8Array(chunk), {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(chunk.byteLength), "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The file could not be read from storage." }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token." }, { status: 401 });
  const { fileId } = await params;
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const index = Number(url.searchParams.get("index"));
  const count = Number(url.searchParams.get("count"));
  const sizeBytes = Number(url.searchParams.get("sizeBytes"));
  const updatedAt = url.searchParams.get("updatedAt") || "";
  const file = await accessibleFile(fileId, device.userId);
  if (!file || file.event_id !== eventId) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const role = await getEventRole(eventId, device.userId);
  if (!role || !rolePermissions(role).canManageFiles) return NextResponse.json({ error: "You cannot upload files to this event." }, { status: 403 });
  const expectedCount = Math.ceil(sizeBytes / CHUNK_BYTES);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES || count !== expectedCount || !Number.isInteger(index) || index < 0 || index >= count || sizeBytes !== file.size_bytes || Number.isNaN(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== file.updated_at) {
    await (await getDb()).prepare("DELETE FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?").run(device.id, fileId);
    return NextResponse.json({ error: "Invalid file chunk metadata." }, { status: 400 });
  }
  const expectedSize = index === count - 1 ? sizeBytes - index * CHUNK_BYTES : CHUNK_BYTES;
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength !== expectedSize) {
    return NextResponse.json({ error: "File chunk size did not match." }, { status: 400 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength !== expectedSize) return NextResponse.json({ error: "File chunk size did not match." }, { status: 400 });

  const db = await getDb();
  const now = new Date().toISOString();
  await db.prepare("DELETE FROM sync_file_upload_chunks WHERE created_at<?").run(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const priorChunk = await db.prepare(
    `SELECT 1 FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?
     AND (event_id<>? OR size_bytes<>? OR updated_at<>? OR chunk_count<>?) LIMIT 1`,
  ).get(device.id, fileId, eventId, sizeBytes, file.updated_at, count);
  if (priorChunk) await db.prepare("DELETE FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?").run(device.id, fileId);
  await db.prepare(
    `INSERT INTO sync_file_upload_chunks
       (device_id,file_id,event_id,name,mime_type,size_bytes,updated_at,chunk_index,chunk_count,bytes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(device_id,file_id,chunk_index) DO UPDATE SET
       event_id=excluded.event_id,name=excluded.name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,
       updated_at=excluded.updated_at,chunk_count=excluded.chunk_count,bytes=excluded.bytes,created_at=excluded.created_at`,
  ).run(device.id, fileId, eventId, file.name, file.mime_type, sizeBytes, file.updated_at, index, count, bytes, now);

  const received = await db.prepare(
    "SELECT COUNT(*) AS count FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?",
  ).get(device.id, fileId) as { count: number };
  if (received.count < count) return NextResponse.json({ received: received.count, complete: false });
  const chunks = await db.prepare(
    `SELECT chunk_index,bytes FROM sync_file_upload_chunks
     WHERE device_id=? AND file_id=? ORDER BY chunk_index`,
  ).all(device.id, fileId) as { chunk_index: number; bytes: Uint8Array }[];
  if (chunks.length !== count || chunks.some((chunk, i) => chunk.chunk_index !== i)) {
    await db.prepare("DELETE FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?").run(device.id, fileId);
    return NextResponse.json({ error: "File upload chunks are inconsistent; retry the upload." }, { status: 409 });
  }

  const combined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.bytes)));
  if (combined.byteLength !== sizeBytes) return NextResponse.json({ error: "Uploaded file size did not match." }, { status: 400 });
  const storageKey = await putObject({
    key: `uploads/${eventId}/${fileId}/${Date.parse(file.updated_at)}`,
    bytes: new Uint8Array(combined),
    contentType: file.mime_type,
  });
  const saved = await db.prepare(
    "UPDATE event_files SET storage_key=? WHERE id=? AND event_id=? AND updated_at=?",
  ).run(storageKey, fileId, eventId, file.updated_at);
  if (saved.changes === 0) {
    if (storageKey !== file.storage_key) await deleteObject(storageKey);
    await db.prepare("DELETE FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?").run(device.id, fileId);
    return NextResponse.json({ error: "The file changed during upload. Retry sync." }, { status: 409 });
  }
  if (!file.storage_key.startsWith("sync-pending:") && file.storage_key !== storageKey) {
    await deleteObject(file.storage_key);
  }
  await db.prepare("DELETE FROM sync_file_upload_chunks WHERE device_id=? AND file_id=?").run(device.id, fileId);
  return NextResponse.json({ received: count, complete: true });
}
