import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIdentifier } from "@/lib/client-ip";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 5 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function validSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(sha256(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST() {
  const identifier = await requestIdentifier();
  const limit = checkRateLimit({ key: `mobile-google-pair:${identifier}`, limit: 10, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) return jsonError("Too many sign-in attempts. Try again later.", 429);

  const db = await getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  await db.prepare(
    `DELETE FROM sync_devices WHERE id IN (
       SELECT device_id FROM mobile_google_pairing_sessions
       WHERE expires_at <= ? AND device_id IS NOT NULL
     )`,
  ).run(nowIso);
  await db.prepare("DELETE FROM mobile_google_pairing_sessions WHERE expires_at <= ?").run(nowIso);

  const id = randomUUID();
  const pollSecret = randomBytes(32).toString("base64url");
  const launchCode = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await db.prepare(
    `INSERT INTO mobile_google_pairing_sessions (id, poll_secret_hash, launch_code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, sha256(pollSecret), sha256(launchCode), expiresAt, nowIso);

  return NextResponse.json({ id, pollSecret, launchCode, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  let body: { id?: unknown; launchCode?: unknown };
  try {
    body = await request.json() as { id?: unknown; launchCode?: unknown };
  } catch {
    return jsonError("Invalid pairing request.", 400);
  }
  const id = typeof body.id === "string" ? body.id : "";
  const launchCode = typeof body.launchCode === "string" ? body.launchCode : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || launchCode.length < 32 || launchCode.length > 128) {
    return jsonError("Invalid pairing request.", 400);
  }

  const db = await getDb();
  const row = await db.prepare(
    `SELECT launch_code_hash, status, expires_at
     FROM mobile_google_pairing_sessions WHERE id = ?`,
  ).get(id) as { launch_code_hash: string; status: string; expires_at: string } | undefined;
  if (!row || row.status !== "pending" || row.expires_at <= new Date().toISOString() || !validSecret(launchCode, row.launch_code_hash)) {
    return jsonError("Google sign-in request expired. Start again on your phone.", 410);
  }

  const baseUrl = new URL(request.url).origin;
  const startUrl = new URL("/api/mobile/google-pair/start", baseUrl);
  startUrl.hash = new URLSearchParams({ id, code: launchCode }).toString();
  return NextResponse.json({ url: startUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const secret = authorization.startsWith("Pairing ") ? authorization.slice(8).trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || secret.length < 32 || secret.length > 128) {
    return jsonError("Invalid pairing session.", 400);
  }
  const db = await getDb();
  const row = await db.prepare(
    "SELECT poll_secret_hash, device_id, user_id FROM mobile_google_pairing_sessions WHERE id = ?",
  ).get(id) as { poll_secret_hash: string; device_id: string | null; user_id: string | null } | undefined;
  if (!row || !validSecret(secret, row.poll_secret_hash)) return jsonError("Invalid pairing session.", 404);
  await db.prepare("DELETE FROM mobile_google_pairing_sessions WHERE id = ?").run(id);
  if (row.device_id && row.user_id) {
    const { deleteSyncDevice } = await import("@/lib/sync");
    await deleteSyncDevice(row.user_id, row.device_id);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const secret = authorization.startsWith("Pairing ") ? authorization.slice(8).trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || secret.length < 32 || secret.length > 128) {
    return jsonError("Invalid pairing session.", 400);
  }
  const db = await getDb();
  const row = await db.prepare(
    "SELECT poll_secret_hash, status FROM mobile_google_pairing_sessions WHERE id = ?",
  ).get(id) as { poll_secret_hash: string; status: string } | undefined;
  if (!row || !validSecret(secret, row.poll_secret_hash)) return jsonError("Invalid pairing session.", 404);
  if (row.status === "complete") {
    const pairedDevice = await db.prepare(
      "SELECT device_id, user_id FROM mobile_google_pairing_sessions WHERE id = ?",
    ).get(id) as { device_id: string | null; user_id: string | null } | undefined;
    await db.prepare("DELETE FROM mobile_google_pairing_sessions WHERE id = ?").run(id);
    if (pairedDevice?.device_id && pairedDevice.user_id) {
      const { deleteSyncDevice } = await import("@/lib/sync");
      await deleteSyncDevice(pairedDevice.user_id, pairedDevice.device_id);
    }
  } else {
    await db.prepare("DELETE FROM mobile_google_pairing_sessions WHERE id = ?").run(id);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const secret = authorization.startsWith("Pairing ") ? authorization.slice(8).trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || secret.length < 32 || secret.length > 128) {
    return jsonError("Invalid pairing session.", 400);
  }

  const db = await getDb();
  const row = await db.prepare(
    `SELECT poll_secret_hash, status, expires_at
     FROM mobile_google_pairing_sessions WHERE id = ?`,
  ).get(id) as { poll_secret_hash: string; status: string; expires_at: string } | undefined;

  if (!row || row.expires_at <= new Date().toISOString() || !validSecret(secret, row.poll_secret_hash)) {
    return jsonError("Google sign-in expired. Start again on your phone.", 410);
  }
  if (row.status !== "complete") {
    return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await db.prepare(
    `DELETE FROM mobile_google_pairing_sessions
     WHERE id = ? AND poll_secret_hash = ? AND status = 'complete'
     RETURNING device_id, device_token, user_id, user_name, user_email, user_role`,
  ).get(id, row.poll_secret_hash) as {
    device_id: string; device_token: string; user_id: string; user_name: string; user_email: string; user_role: string;
  } | undefined;
  if (!result) return jsonError("Pairing result was already claimed. Start again on your phone.", 410);

  return NextResponse.json({
    status: "complete",
    token: result.device_token,
    device: { id: result.device_id },
    user: { id: result.user_id, name: result.user_name, email: result.user_email, workspaceRole: result.user_role },
  }, { headers: { "Cache-Control": "no-store" } });
}
