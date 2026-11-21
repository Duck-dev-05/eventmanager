import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCode,
  getGoogleConfig,
  verifyGoogleIdToken,
} from "@/lib/google";
import { setSessionCookie } from "@/lib/session-cookie";
import { upsertGoogleUser } from "@/lib/users";
import { createSyncDevice, deleteSyncDevice } from "@/lib/sync";
import { getDb } from "@/lib/db";
import { createHash } from "node:crypto";

function failure(origin: string, reason: string) {
  // Keep OAuth diagnostics server-side and never log authorization codes,
  // cookies, tokens, or client credentials.
  console.error(`[google-auth] callback failed: ${reason}`);
  const response = NextResponse.redirect(new URL("/login", origin));

  response.cookies.set("auth_notice", reason, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60,
  });

  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  const store = await cookies();
  const pending = store.get("google_oauth")?.value;
  store.delete("google_oauth");

  const config = getGoogleConfig(url.origin);
  if (googleError) return failure(url.origin, "google_sign_in_cancelled_or_rejected");
  if (!config) return failure(url.origin, "server_oauth_config_missing");
  if (!code || !state) return failure(url.origin, "google_callback_missing_code_or_state");
  if (!pending) return failure(url.origin, "oauth_cookie_missing");

  let saved: {
    state?: string;
    verifier?: string;
    next?: string;
    mobilePair?: { id?: string; launchCode?: string };
  };
  try {
    saved = JSON.parse(pending);
  } catch {
    return failure(url.origin, "oauth_cookie_invalid");
  }

  if (!saved.state || saved.state !== state || !saved.verifier) {
    return failure(url.origin, "oauth_state_mismatch");
  }

  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode({
      code,
      config,
      verifier: saved.verifier,
    });
  } catch {
    return failure(url.origin, "google_token_endpoint_unreachable");
  }
  if (!tokens?.id_token) {
    return failure(url.origin, "google_code_exchange_rejected");
  }

  let claims: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  try {
    claims = await verifyGoogleIdToken(tokens.id_token, config.clientId);
  } catch {
    return failure(url.origin, "google_id_token_verification_unavailable");
  }
  if (!claims?.email) {
    return failure(url.origin, "google_id_token_invalid_or_client_id_mismatch");
  }

  const name =
    claims.name?.trim() ||
    [claims.given_name, claims.family_name].filter(Boolean).join(" ").trim() ||
    undefined;

  const user = await upsertGoogleUser({
    sub: claims.sub,
    email: claims.email,
    name,
    picture: claims.picture,
  });

  await setSessionCookie(user);

  if (saved.mobilePair?.id && saved.mobilePair.launchCode) {
    const digest = createHash("sha256").update(saved.mobilePair.launchCode).digest("hex");
    const db = await getDb();
    const now = new Date().toISOString();
    const claim = await db.prepare(
      `UPDATE mobile_google_pairing_sessions SET status = 'processing'
       WHERE id = ? AND launch_code_hash = ? AND status = 'pending' AND expires_at > ?`,
    ).run(saved.mobilePair.id, digest, now);

    if (!claim.changes) return failure(url.origin, "mobile_pair_session_expired_or_claimed");

    let device: Awaited<ReturnType<typeof createSyncDevice>> | undefined;
    try {
      device = await createSyncDevice(user.id, "EventPulse Android");
      const completed = await db.prepare(
        `UPDATE mobile_google_pairing_sessions
         SET status = 'complete', device_id = ?, device_token = ?, user_id = ?, user_name = ?, user_email = ?, user_role = ?
         WHERE id = ? AND launch_code_hash = ? AND status = 'processing' AND expires_at > ?`,
      ).run(
        device.id,
        device.token,
        user.id,
        user.name,
        user.email,
        user.workspaceRole,
        saved.mobilePair.id,
        digest,
        new Date().toISOString(),
      );
      if (!completed.changes) {
        await deleteSyncDevice(user.id, device.id);
        return failure(url.origin, "mobile_pair_result_save_failed");
      }
    } catch {
      if (device) await deleteSyncDevice(user.id, device.id).catch(() => {});
      await db.prepare(
        "DELETE FROM mobile_google_pairing_sessions WHERE id = ? AND status = 'processing'",
      ).run(saved.mobilePair.id);
      return failure(url.origin, "mobile_pair_device_creation_failed");
    }

    return NextResponse.redirect(new URL("/mobile-google-pair?complete=1", url.origin));
  }

  const next =
    saved.next?.startsWith("/") && !saved.next.startsWith("//")
      ? saved.next
      : "/dashboard";

  return NextResponse.redirect(new URL(next, url.origin));
}
