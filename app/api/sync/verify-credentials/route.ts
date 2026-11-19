import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIdentifier } from "@/lib/client-ip";

const INVALID_CREDENTIALS = { error: "Email or password is incorrect." };

/** Credential verification for an existing desktop account after password recovery. */
export async function POST(request: Request) {
  const identifier = await requestIdentifier();
  const limit = checkRateLimit({
    key: `desktop-credential-check:${identifier}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let email = "";
  let password = "";
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const user = await findUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  return NextResponse.json({ user: { email: user.email } });
}
