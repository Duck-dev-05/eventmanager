import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/activity";
import { createEventInvite, getEventTitle } from "@/lib/events";
import { sendEventInviteEmail } from "@/lib/event-invite-email";
import { createNotification } from "@/lib/notifications";
import { isAssignableRole, ROLE_LABELS } from "@/lib/roles";
import { authenticateSyncRequest } from "@/lib/sync";
import { findUserByEmail, findUserById } from "@/lib/users";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: { eventId?: unknown; email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "member";
  if (!eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isAssignableRole(role)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }

  const result = await createEventInvite({
    eventId,
    email,
    inviterId: device.userId,
    role,
  });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  const [title, inviter] = await Promise.all([
    getEventTitle(eventId),
    findUserById(device.userId),
  ]);
  if (!inviter) return NextResponse.json({ error: "The paired account no longer exists." }, { status: 401 });

  const eventTitle = title ?? "an event";
  const roleLabel = ROLE_LABELS[role];
  const invitePath = `/invite/${result.inviteToken}`;
  const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  const inviteUrl = `${baseUrl}${invitePath}`;

  await logEventActivity({
    eventId,
    actorId: device.userId,
    kind: "member",
    summary: `invited ${email} as ${roleLabel}`,
  });

  const invitedUser = await findUserByEmail(email);
  if (invitedUser) {
    await createNotification({
      userId: invitedUser.id,
      eventId,
      kind: "event_shared",
      title: `Invitation to ${eventTitle}`,
      message: `${inviter.name} invited you as ${roleLabel}.`,
      linkUrl: invitePath,
    });
  }

  const delivery = await sendEventInviteEmail({
    recipientEmail: email,
    recipientName: email.split("@")[0] || "there",
    eventTitle,
    inviterName: inviter.name,
    roleLabel,
    inviteUrl,
  });

  return NextResponse.json({
    success: true,
    inviteUrl,
    message: delivery.sent
      ? `Invitation emailed to ${email} as ${roleLabel}.`
      : `Invitation created for ${email} as ${roleLabel}. Email delivery is not configured — copy the link below and share it.`,
  });
}
