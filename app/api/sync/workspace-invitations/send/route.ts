import { NextResponse } from "next/server";
import { sendWorkspaceInvitation } from "@/lib/workspace-invitation-email";
import { authenticateSyncRequest } from "@/lib/sync";
import { findUserById } from "@/lib/users";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const inviter = await findUserById(device.userId);
  if (!inviter) {
    return NextResponse.json({ error: "The paired account no longer exists." }, { status: 401 });
  }

  const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  const inviteUrl = `${baseUrl}/register`;
  const delivery = await sendWorkspaceInvitation({
    recipientEmail: email,
    inviterName: inviter.name,
    inviteUrl,
  });

  if (delivery.sent) {
    return NextResponse.json({ success: true, inviteUrl, message: `EventPulse invitation emailed to ${email}.` });
  }

  return NextResponse.json({
    success: true,
    inviteUrl,
    message: delivery.reason === "not-configured"
      ? "The invitation is ready, but email delivery is not configured. Copy and share the link."
      : "The invitation is ready, but the email could not be delivered. Copy and share the link.",
  });
}
