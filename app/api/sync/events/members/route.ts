import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/activity";
import { addExistingEventMember, canManageEvent, getEventTitle, listUsersAvailableForEvent } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { ROLE_LABELS } from "@/lib/roles";
import { authenticateSyncRequest } from "@/lib/sync";
import { findUserById } from "@/lib/users";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: { action?: unknown; eventId?: unknown; userId?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = body.action;
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  if (!(await canManageEvent(eventId, device.userId))) {
    return NextResponse.json({ error: "Only the event owner and admins can manage this event's members." }, { status: 403 });
  }

  if (action === "list") {
    const users = await listUsersAvailableForEvent(eventId, device.userId);
    return NextResponse.json({ users });
  }

  if (action !== "add") {
    return NextResponse.json({ error: "Choose a valid member action." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const role = typeof body.role === "string" ? body.role : "member";
  if (!userId) return NextResponse.json({ error: "Choose an existing user." }, { status: 400 });

  const result = await addExistingEventMember({
    eventId,
    userId,
    actorId: device.userId,
    role,
  });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

  const [target, inviter] = await Promise.all([
    findUserById(userId),
    findUserById(device.userId),
  ]);
  if (target && inviter) {
    const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
    const eventTitle = await getEventTitle(eventId);
    await logEventActivity({
      eventId,
      actorId: inviter.id,
      kind: "member",
      summary: `added ${target.name} directly to the event`,
    });
    await createNotification({
      userId: target.id,
      eventId,
      kind: "event_shared",
      title: `${eventTitle ?? "Event"}: you were added to the event`,
      message: `${inviter.name} added you as ${roleLabel}.`,
      linkUrl: `/events/${eventId}`,
    });
  }

  return NextResponse.json({ success: true });
}
