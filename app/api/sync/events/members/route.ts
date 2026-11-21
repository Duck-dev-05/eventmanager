import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/activity";
import {
  addExistingEventMember,
  canManageEvent,
  getEventRole,
  getEventTitle,
  listUsersAvailableForEvent,
  removeEventMember,
  resendEventInvite,
  updateEventMemberRole,
  createEventInvite,
} from "@/lib/events";
import { sendEventInviteEmail } from "@/lib/event-invite-email";
import { createNotification } from "@/lib/notifications";
import { getDb } from "@/lib/db";
import { isAssignableRole, ROLE_LABELS } from "@/lib/roles";
import { authenticateSyncRequest } from "@/lib/sync";
import { findUserByEmail, findUserById } from "@/lib/users";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: { action?: unknown; eventId?: unknown; userId?: unknown; memberId?: unknown; inviteId?: unknown; email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  if (!(await canManageEvent(eventId, device.userId))) {
    return NextResponse.json({ error: "Only the event owner and admins can manage this event's members." }, { status: 403 });
  }

  if (action === "list" || action === "details") {
    const db = await getDb();
    const [users, members, invitations] = await Promise.all([
      listUsersAvailableForEvent(eventId, device.userId),
      db.prepare(
        `SELECT em.id, em.event_id AS eventId, em.user_id AS userId, u.name, u.email,
                u.avatar_url AS avatarUrl, em.role, em.invited_at AS invitedAt, em.status
         FROM event_members em JOIN users u ON u.id = em.user_id
         WHERE em.event_id = ? AND em.status = 'accepted'
         ORDER BY em.invited_at, u.name`,
      ).all(eventId),
      db.prepare(
        `SELECT id, email, role, status, created_at AS createdAt, expires_at AS expiresAt
         FROM event_invites WHERE event_id = ? AND status = 'pending'
         ORDER BY created_at DESC`,
      ).all(eventId),
    ]);
    return NextResponse.json({ users, members, invitations });
  }

  const role = typeof body.role === "string" ? body.role : "member";

  if (action === "add") {
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "Choose an existing user." }, { status: 400 });
    const result = await addExistingEventMember({ eventId, userId, actorId: device.userId, role });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    const [target, inviter] = await Promise.all([findUserById(userId), findUserById(device.userId)]);
    if (target && inviter) {
      const eventTitle = await getEventTitle(eventId);
      await logEventActivity({ eventId, actorId: inviter.id, kind: "member", summary: `added ${target.name} directly to the event` });
      await createNotification({
        userId: target.id,
        eventId,
        kind: "event_shared",
        title: `${eventTitle ?? "Event"}: you were added to the event`,
        message: `${inviter.name} added you as ${ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}.`,
        linkUrl: `/events/${eventId}`,
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!isAssignableRole(role)) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
    const result = await createEventInvite({ eventId, email, inviterId: device.userId, role });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    const [eventTitle, inviter, invitedUser] = await Promise.all([
      getEventTitle(eventId), findUserById(device.userId), findUserByEmail(email),
    ]);
    if (!inviter) return NextResponse.json({ error: "The paired account no longer exists." }, { status: 401 });
    const title = eventTitle ?? "an event";
    const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
    const invitePath = `/invite/${result.inviteToken}`;
    const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
    const inviteUrl = `${baseUrl}${invitePath}`;
    await logEventActivity({ eventId, actorId: device.userId, kind: "member", summary: `invited ${email} as ${roleLabel}` });
    if (invitedUser) {
      await createNotification({
        userId: invitedUser.id, eventId, kind: "event_shared", title: `Invitation to ${title}`,
        message: `${inviter.name} invited you as ${roleLabel}.`, linkUrl: invitePath,
      });
    }
    const delivery = await sendEventInviteEmail({
      recipientEmail: email, recipientName: email.split("@")[0] || "there", eventTitle: title,
      inviterName: inviter.name, roleLabel, inviteUrl,
    });
    return NextResponse.json({
      success: true, inviteUrl,
      message: delivery.sent ? `Invitation emailed to ${email} as ${roleLabel}.` : `Invitation created for ${email}. Email delivery is not configured; share the link manually.`,
    });
  }

  if (action === "resend") {
    const inviteId = typeof body.inviteId === "string" ? body.inviteId.trim() : "";
    if (!inviteId) return NextResponse.json({ error: "Choose an invitation." }, { status: 400 });
    const result = await resendEventInvite({ inviteId, actorId: device.userId });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    const inviter = await findUserById(device.userId);
    if (!inviter) return NextResponse.json({ error: "The paired account no longer exists." }, { status: 401 });
    const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
    const inviteUrl = `${baseUrl}${result.invitePath}`;
    const roleLabel = ROLE_LABELS[result.role as keyof typeof ROLE_LABELS] ?? result.role;
    await logEventActivity({ eventId, actorId: device.userId, kind: "member", summary: `re-sent the invitation to ${result.email}` });
    const delivery = await sendEventInviteEmail({
      recipientEmail: result.email, recipientName: result.email.split("@")[0] || "there",
      eventTitle: result.eventTitle, inviterName: inviter.name, roleLabel, inviteUrl,
    });
    return NextResponse.json({ success: true, inviteUrl, message: delivery.sent ? `Invitation re-sent to ${result.email}.` : `Email is not configured. Share the invitation link manually.` });
  }

  if (action === "cancel-invitation") {
    const inviteId = typeof body.inviteId === "string" ? body.inviteId.trim() : "";
    if (!inviteId) return NextResponse.json({ error: "Choose an invitation." }, { status: 400 });
    const db = await getDb();
    const changed = await db.prepare(
      "UPDATE event_invites SET status = 'cancelled' WHERE id = ? AND event_id = ? AND status = 'pending'",
    ).run(inviteId, eventId);
    if (!changed.changes) return NextResponse.json({ error: "This invitation is no longer pending." }, { status: 404 });
    await logEventActivity({ eventId, actorId: device.userId, kind: "member", summary: "cancelled a pending invitation" });
    return NextResponse.json({ success: true });
  }

  if (action === "remove") {
    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    if (!memberId) return NextResponse.json({ error: "Choose a member." }, { status: 400 });
    const actorRole = await getEventRole(eventId, device.userId);
    const targetRole = await getEventRole(eventId, memberId);
    if (actorRole !== "owner" && actorRole !== "admin") return NextResponse.json({ error: "Only the event owner and admins can remove people." }, { status: 403 });
    if (actorRole === "admin" && targetRole !== "member" && targetRole !== "viewer") return NextResponse.json({ error: "Only the event owner can remove an admin." }, { status: 403 });
    const target = await findUserById(memberId);
    const result = await removeEventMember({ eventId, userId: memberId });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    await logEventActivity({ eventId, actorId: device.userId, kind: "member", summary: `removed ${target?.name ?? "a member"} from the event` });
    return NextResponse.json({ success: true });
  }

  if (action === "change-role") {
    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    if (!memberId) return NextResponse.json({ error: "Choose a member." }, { status: 400 });
    const result = await updateEventMemberRole({ eventId, memberId, role, actorId: device.userId });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    const target = await findUserById(memberId);
    const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
    await logEventActivity({ eventId, actorId: device.userId, kind: "member", summary: `changed ${target?.name ?? "a member"}'s role to ${roleLabel}` });
    await createNotification({
      userId: memberId, eventId, kind: "event_shared", title: `${await getEventTitle(eventId) ?? "Event"}: your role changed`,
      message: `You are now ${roleLabel} on this event.`, linkUrl: `/events/${eventId}`,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Choose a valid member action." }, { status: 400 });
}
