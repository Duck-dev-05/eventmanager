import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  getGoogleConfig,
} from "@/lib/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = getGoogleConfig(url.origin);

  if (!config) {
    return NextResponse.redirect(new URL("/login?notice=google-unavailable", url));
  }

  const state = createState();
  const { verifier, challenge } = createPkcePair();
  // Invitation links land on /login?next=/invite/<token>; carry that path
  // through OAuth so Google sign-in finishes where the person started.
  const requestedNext = url.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : undefined;

  (await cookies()).set(
    "google_oauth",
    JSON.stringify({ state, verifier, next }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    },
  );

  return NextResponse.redirect(
    buildAuthorizationUrl({ config, state, challenge }),
  );
}
