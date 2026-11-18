import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { createSyncDevice } from "@/lib/sync";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIdentifier } from "@/lib/client-ip";

/**
 * Pairs a Google-authenticated desktop user using a short-lived Google access
 * token. Google validates the token and supplies the verified email; website
 * pairing is allowed only for the existing account with that same email.
 */
export async function POST(request: Request) {
  const identifier = await requestIdentifier();
  const limit = checkRateLimit({
    key: `sync-google-pair:${identifier}`,
    limit: 10,
    windowMs: 5 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let accessToken = "";
  try {
    const body = (await request.json()) as { accessToken?: unknown };
    accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!accessToken || accessToken.length > 4096) {
    return NextResponse.json({ error: "A valid Google token is required." }, { status: 400 });
  }

  let googleResponse: Response;
  try {
    googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not verify the Google account." }, { status: 502 });
  }
  if (!googleResponse.ok) {
    return NextResponse.json({ error: "Google rejected the sign-in token." }, { status: 401 });
  }

  const googleUser = (await googleResponse.json()) as {
    email?: unknown;
    email_verified?: unknown;
  };
  if (
    typeof googleUser.email !== "string" ||
    googleUser.email_verified !== true
  ) {
    return NextResponse.json({ error: "Google did not provide a verified email." }, { status: 401 });
  }

  const user = await findUserByEmail(googleUser.email);
  if (!user || user.email.toLowerCase() !== googleUser.email.toLowerCase()) {
    return NextResponse.json(
      { error: "No website account is registered with this Google email." },
      { status: 404 },
    );
  }

  const device = await createSyncDevice(user.id, "Desktop app");
  return NextResponse.json({
    token: device.token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
