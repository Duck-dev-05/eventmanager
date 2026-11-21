import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword } from "@/lib/users";
import { createSyncDevice } from "@/lib/sync";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIdentifier } from "@/lib/client-ip";

/**
 * Auto-pairing for the desktop app. The desktop signs in with the user's
 * normal account credentials; on success a sync device is created and its
 * once-visible bearer token returned. Rate limited like the login form.
 */
export async function POST(request: Request) {
  const identifier = await requestIdentifier();
  const limit = checkRateLimit({
    key: `sync-auto-pair:${identifier}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let email = "";
  let password = "";
  let deviceName = "Desktop app";
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown; deviceName?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
    if (typeof body.deviceName === "string") {
      const requestedName = body.deviceName.trim();
      if (requestedName.length > 80) {
        return NextResponse.json({ error: "Device name must be 80 characters or fewer." }, { status: 400 });
      }
      if (requestedName) deviceName = requestedName;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  const device = await createSyncDevice(user.id, deviceName);

  return NextResponse.json({
    device: { id: device.id, name: device.name },
    user: { id: user.id, name: user.name, email: user.email, workspaceRole: user.workspaceRole },
    token: device.token,
  });
}
