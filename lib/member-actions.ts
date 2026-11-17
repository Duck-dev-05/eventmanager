"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logEventActivity } from "./activity";
import {
  acceptEventInvite,
  canManageEvent,
  createEventInvite,
  declineEventInviteById,
  getEventRole,
  getEventTitle,
  leaveEvent as leaveEventRecord,
  removeEventMember,
  resendEventInvite,
  updateEventMemberRole,
} from "./events";
import { sendEventInviteEmail } from "./event-invite-email";
import { createNotification } from "./notifications";
import { isAssignableRole, ROLE_LABELS } from "./roles";
import { getSessionUser } from "./session-cookie";
import { findUserByEmail, findUserById } from "./users";

export type InviteState =
  | { error?: string; success?: string; email?: string; inviteUrl?: string }
  | undefined;

export type MemberActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function appBaseUrl() {
  return process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
}

/**
 * Emails the invitation when Gmail is configured and always returns a link the
 * organiser can copy, so invitations work even without an email transport.
 */
async function deliverInvite({
  email,
  eventTitle,
  inviterName,
  roleLabel,
  invitePath,
}: {
  email: string;
  eventTitle: string;
  inviterName: string;
  roleLabel: string;
  invitePath: string;
}): Promise<{ sent: boolean; url: string }> {
  const base = appBaseUrl();
  const url = base ? `${base}${invitePath}` : invitePath;

  if (!base) return { sent: false, url };

  const delivery = await sendEventInviteEmail({
    recipientEmail: email,
    recipientName: email.split("@")[0] || "there",
    eventTitle,
    inviterName,
    roleLabel,
    inviteUrl: url,
  });

  return { sent: delivery.sent, url };
}

export async function inviteMember(
  _state: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const eventId = text(formData.get("eventId"));
  const email = text(formData.get("email"));
  const roleEntry = formData.get("role");
  const role = typeof roleEntry === "string" ? roleEntry : "member";

  if (!eventId) {
    return { error: "Missing event." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", email };
  }
  if (!isAssignableRole(role)) {
    return { error: "Choose a valid role for this person.", email };
  }

  const user = await getSessionUser();
  if (!user) {
    return { error: "You must be signed in to invite someone." };
  }

  if (!(await canManageEvent(eventId, user.id))) {
    return { error: "Only the event owner and admins can invite people.", email };
  }

  const result = await createEventInvite({
    eventId,
    email,
    inviterId: user.id,
    role,
  });
  if (!result.success) {
    return { error: result.error ?? "Could not send the invitation.", email };
  }

  revalidatePath(`/events/${eventId}/members`);

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "member",
    summary: `invited ${email} as ${ROLE_LABELS[role]}`,
  });

  const title = (await getEventTitle(eventId)) ?? "an event";

  const invitedUser = await findUserByEmail(email);
  if (invitedUser) {
    await createNotification({
      userId: invitedUser.id,
      eventId,
      kind: "event_shared",
      title: `Invitation to ${title}`,
      message: `${user.name} invited you as ${ROLE_LABELS[role]}.`,
      linkUrl: `/invite/${result.inviteToken}`,
    });
  }

  const delivery = await deliverInvite({
    email,
    eventTitle: title,
    inviterName: user.name,
    roleLabel: ROLE_LABELS[role],
    invitePath: `/invite/${result.inviteToken}`,
  });

  return {
    success: delivery.sent
      ? `Invitation emailed to ${email} as ${ROLE_LABELS[role]}.`
      : `Invitation created for ${email} as ${ROLE_LABELS[role]}. Email delivery is not configured — copy the link below and share it.`,
    email,
    inviteUrl: delivery.url,
  };
}

/** Re-sends an invitation that is still pending. */
export async function resendInvitation(
  inviteId: string,
): Promise<MemberActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const id = typeof inviteId === "string" ? inviteId.trim() : "";
  if (!id) return { success: false, error: "Missing invitation." };

  const result = await resendEventInvite({ inviteId: id, actorId: user.id });
  if (!result.success) return result;

  await logEventActivity({
    eventId: result.eventId,
    actorId: user.id,
    kind: "member",
    summary: `re-sent the invitation to ${result.email}`,
  });

  const delivery = await deliverInvite({
    email: result.email,
    eventTitle: result.eventTitle,
    inviterName: user.name,
    roleLabel: ROLE_LABELS[result.role],
    invitePath: result.invitePath,
  });

  revalidatePath(`/events/${result.eventId}/members`);

  return {
    success: true,
    message: delivery.sent
      ? `Invitation re-sent to ${result.email}.`
      : `Email is not configured. Share this link: ${delivery.url}`,
  };
}

export async function removeMember(
  eventId: string,
  memberId: string,
): Promise<MemberActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const actorRole = await getEventRole(eventId, user.id);
  if (actorRole === null || !(actorRole === "owner" || actorRole === "admin")) {
    return { success: false, error: "Only the event owner and admins can remove people." };
  }

  const targetRole = await getEventRole(eventId, memberId);
  if (targetRole === null) {
    return { success: false, error: "This person is not a member of the event." };
  }
  if (actorRole === "admin" && targetRole !== "member" && targetRole !== "viewer") {
    return { success: false, error: "Only the event owner can remove an admin." };
  }

  const target = await findUserById(memberId);

  const result = await removeEventMember({ eventId, userId: memberId });
  if (!result.success) return result;

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "member",
    summary: `removed ${target?.name ?? target?.email ?? "a member"} from the event`,
  });

  revalidatePath(`/events/${eventId}/members`);
  return { success: true };
}

export async function changeMemberRole(
  eventId: string,
  memberId: string,
  role: string,
): Promise<MemberActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const target = await findUserById(memberId);

  const result = await updateEventMemberRole({
    eventId,
    memberId,
    role,
    actorId: user.id,
  });
  if (!result.success) return result;

  const roleLabel = isAssignableRole(role) ? ROLE_LABELS[role] : role;

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "member",
    summary: `changed ${target?.name ?? target?.email ?? "a member"}'s role to ${roleLabel}`,
  });

  const title = (await getEventTitle(eventId)) ?? "Event";
  await createNotification({
    userId: memberId,
    eventId,
    kind: "event_shared",
    title: `${title}: your role changed`,
    message: `You are now ${roleLabel} on this event.`,
    linkUrl: `/events/${eventId}`,
  });

  revalidatePath(`/events/${eventId}/members`);
  return { success: true };
}

export async function declineInvitation(
  inviteId: string,
): Promise<MemberActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await declineEventInviteById(inviteId);
  if (!result.success) return result;

  return { success: true };
}

export async function leaveEvent(eventId: string): Promise<MemberActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await leaveEventRecord({ eventId, userId: user.id });
  if (!result.success) return result;

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "member",
    summary: `${user.name} left the event`,
  });

  revalidatePath("/my-events");
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function acceptInvite(formData: FormData) {
  const token = text(formData.get("token"));
  if (!token) redirect("/my-events");

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const result = await acceptEventInvite({
    token,
    userId: user.id,
    userEmail: user.email,
  });

  if (!result.success) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
  }

  await logEventActivity({
    eventId: result.eventId,
    actorId: user.id,
    kind: "member",
    summary: `${user.name} joined the event`,
  });

  revalidatePath("/my-events");
  revalidatePath("/invitations");
  redirect(`/events/${result.eventId}`);
}

export async function declineInvite(formData: FormData) {
  const token = text(formData.get("token"));
  if (!token) redirect("/my-events");

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const result = await declineInviteByIdForToken(token, user.email);
  if (!result.success) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/invitations");
  redirect("/invitations?status=declined");
}

async function declineInviteByIdForToken(token: string, email: string) {
  const { declineEventInvite } = await import("./events");
  return declineEventInvite(token, email);
}
