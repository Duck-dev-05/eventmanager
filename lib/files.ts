import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDirectory, getDb } from "./db";
import { getEventRole } from "./events";
import { rolePermissions } from "./roles";

import {
  MAX_FILE_BYTES,
  mimeTypeForFileName,
  type EventFile,
} from "./file-types";

export { MAX_FILE_BYTES };
export type { EventFile };

type FileRow = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  uploader_name: string | null;
  created_at: string;
};

export function uploadsDirectory() {
  return path.join(dataDirectory(), "uploads");
}

export async function getEventFiles(eventId: string): Promise<EventFile[]> {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.name, f.mime_type, f.size_bytes,
              u.name AS uploader_name, f.created_at
       FROM event_files f
       LEFT JOIN users u ON u.id = f.uploaded_by
       WHERE f.event_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(eventId) as FileRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploaderName: row.uploader_name ?? "Someone",
    createdAt: row.created_at,
  }));
}

function safeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(extension) ? extension : "";
}

async function filesPermissions(eventId: string, userId: string) {
  const role = await getEventRole(eventId, userId);
  return role === null ? null : rolePermissions(role);
}

export async function storeEventFile({
  eventId,
  actorId,
  fileName,
  mimeType,
  bytes,
}: {
  eventId: string;
  actorId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const permissions = await filesPermissions(eventId, actorId);
  if (!permissions?.canManageFiles) {
    return { success: false, error: "You cannot upload files to this event." };
  }

  const cleanName = fileName.trim() || "Untitled file";
  if (bytes.byteLength === 0) {
    return { success: false, error: "That file is empty." };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { success: false, error: "Files must be 20 MB or smaller." };
  }

  const storageKey = `${eventId}/${randomUUID()}${safeExtension(cleanName)}`;
  const absolutePath = path.join(uploadsDirectory(), storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO event_files
         (id, event_id, name, mime_type, size_bytes, storage_key, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      eventId,
      cleanName.slice(0, 180),
      mimeTypeForFileName(cleanName, mimeType || "application/octet-stream"),
      bytes.byteLength,
      storageKey,
      actorId,
      new Date().toISOString(),
    );

  return { success: true, id };
}

export async function readEventFile({
  eventId,
  fileId,
  userId,
}: {
  eventId: string;
  fileId: string;
  userId: string;
}): Promise<
  | { success: true; name: string; mimeType: string; body: ArrayBuffer }
  | { success: false; error: string; status: number }
> {
  const permissions = await filesPermissions(eventId, userId);
  if (!permissions?.canViewFiles) {
    return { success: false, error: "You cannot open this file.", status: 403 };
  }

  const row = getDb()
    .prepare(
      `SELECT name, mime_type, storage_key
       FROM event_files
       WHERE id = ? AND event_id = ?`,
    )
    .get(fileId, eventId) as
    | { name: string; mime_type: string; storage_key: string }
    | undefined;

  if (!row) {
    return { success: false, error: "This file no longer exists.", status: 404 };
  }

  try {
    const file = await readFile(path.join(uploadsDirectory(), row.storage_key));
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;

    return {
      success: true,
      name: row.name,
      mimeType: mimeTypeForFileName(row.name, row.mime_type),
      body,
    };
  } catch {
    return {
      success: false,
      error: "This file is missing from storage.",
      status: 404,
    };
  }
}

export async function deleteEventFile({
  eventId,
  fileId,
  actorId,
}: {
  eventId: string;
  fileId: string;
  actorId: string;
}): Promise<
  { success: true; name: string } | { success: false; error: string }
> {
  const permissions = await filesPermissions(eventId, actorId);
  if (!permissions?.canDelete) {
    return { success: false, error: "You cannot delete files on this event." };
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT name, storage_key FROM event_files WHERE id = ? AND event_id = ?`,
    )
    .get(fileId, eventId) as
    | { name: string; storage_key: string }
    | undefined;

  if (!row) {
    return { success: false, error: "This file no longer exists." };
  }

  db.prepare(`DELETE FROM event_files WHERE id = ? AND event_id = ?`).run(
    fileId,
    eventId,
  );

  try {
    await unlink(path.join(uploadsDirectory(), row.storage_key));
  } catch {
    // The row is gone either way; a missing file on disk is not an error.
  }

  return { success: true, name: row.name };
}
