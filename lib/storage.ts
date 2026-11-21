import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get as getBlob, put } from "@vercel/blob";
import { dataDirectory } from "./db.ts";

/**
 * Object storage for uploaded event files and profile photos.
 *
 * On Vercel (BLOB_READ_WRITE_TOKEN set) objects go to Vercel Blob and
 * `storage_key`/avatar URLs hold the blob URL. Without a token — local dev and
 * tests — objects fall back to `data/storage/<key>` on disk.
 */

const LOCAL_ROOT = "storage";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

function localPath(key: string) {
  return path.join(dataDirectory(), LOCAL_ROOT, key);
}

function keyFromBlobUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

export async function putObject({
  key,
  bytes,
  contentType,
  allowOverwrite = false,
}: {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  allowOverwrite?: boolean;
}): Promise<string> {
  const token = blobToken();

  if (token) {
    const blob = await put(
      key,
      Buffer.from(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ),
      {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite,
      token,
    });
    return blob.url;
  }

  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return key;
}

/** Reads an object by storage reference (blob URL or local key). */
export async function getObjectRange(
  reference: string,
  start: number,
  length: number,
): Promise<Buffer> {
  if (reference.startsWith("https://")) {
    const response = await fetch(reference, {
      headers: { Range: `bytes=${start}-${start + length - 1}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Object storage returned ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return response.status === 206 ? bytes : bytes.subarray(start, start + length);
  }

  const file = await open(localPath(reference), "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await file.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export async function getObject(reference: string): Promise<Buffer> {
  if (reference.startsWith("https://")) {
    const response = await fetch(reference, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Object storage returned ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const token = blobToken();
  if (token) {
    const result = await getBlob(reference, { access: "public", token });
    if (!result || result.statusCode !== 200) throw new Error("Object storage could not find the requested file.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  return readFile(localPath(reference));
}

/** Deletes a known object key from the configured storage backend. */
export async function deleteObjectKey(key: string): Promise<void> {
  const token = blobToken();
  if (token) {
    await del(key, { token }).catch(() => {});
    return;
  }
  await unlink(localPath(key)).catch(() => {});
}

/** Deletes an object by storage reference; missing objects are ignored. */
export async function deleteObject(reference: string): Promise<void> {
  if (!reference) return;

  if (reference.startsWith("https://")) {
    const key = keyFromBlobUrl(reference);
    if (key) {
      await del(key).catch(() => {});
    }
    return;
  }

  await unlink(localPath(reference)).catch(() => {});
}
