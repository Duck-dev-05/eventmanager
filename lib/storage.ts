import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
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
}: {
  key: string;
  bytes: Uint8Array;
  contentType: string;
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
export async function getObject(reference: string): Promise<Buffer> {
  if (reference.startsWith("https://")) {
    const response = await fetch(reference, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Object storage returned ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(localPath(reference));
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
