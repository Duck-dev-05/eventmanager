import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCode,
  getGoogleConfig,
  verifyGoogleIdToken,
} from "@/lib/google";
import { setSessionCookie } from "@/lib/session-cookie";
import { upsertGoogleUser } from "@/lib/users";

function failure(origin: string) {
  const response = NextResponse.redirect(new URL("/login", origin));

  response.cookies.set("auth_notice", "google", {
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

  const store = await cookies();
  const pending = store.get("google_oauth")?.value;
  store.delete("google_oauth");

  const config = getGoogleConfig(url.origin);
  if (!config || !code || !state || !pending) {
    return failure(url.origin);
  }

  let saved: { state?: string; verifier?: string; next?: string };
  try {
    saved = JSON.parse(pending);
  } catch {
    return failure(url.origin);
  }

  if (!saved.state || saved.state !== state || !saved.verifier) {
    return failure(url.origin);
  }

  const tokens = await exchangeCode({
    code,
    config,
    verifier: saved.verifier,
  });
  if (!tokens?.id_token) {
    return failure(url.origin);
  }

  const claims = await verifyGoogleIdToken(tokens.id_token, config.clientId);
  if (!claims?.email) {
    return failure(url.origin);
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

  const next =
    saved.next?.startsWith("/") && !saved.next.startsWith("//")
      ? saved.next
      : "/dashboard";

  return NextResponse.redirect(new URL(next, url.origin));
}
