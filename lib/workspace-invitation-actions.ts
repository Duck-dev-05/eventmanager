"use server";

import { sendWorkspaceInvitation } from "./workspace-invitation-email.ts";
import { getSessionUser } from "./session-cookie.ts";

export type WorkspaceInvitationState =
  | { error?: string; success?: string; email?: string; inviteUrl?: string }
  | undefined;

export async function sendWorkspaceInvitationAction(
  _state: WorkspaceInvitationState,
  formData: FormData,
): Promise<WorkspaceInvitationState> {
  const email = typeof formData.get("email") === "string"
    ? String(formData.get("email")).trim().toLowerCase()
    : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", email };
  }

  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to invite someone.", email };
  if (user.email.toLowerCase() === email) {
    return { error: "You cannot invite your own email address.", email };
  }

  const baseUrl = process.env.APP_URL?.trim().replace(/\/$/, "")
    || "https://eventmanager-5dsz.vercel.app";
  const inviteUrl = `${baseUrl}/register`;
  const delivery = await sendWorkspaceInvitation({
    recipientEmail: email,
    inviterName: user.name,
    inviteUrl,
  });

  if (delivery.sent) {
    return { success: `EventPulse invitation emailed to ${email}.`, email, inviteUrl };
  }
  return {
    success: delivery.reason === "not-configured"
      ? "The invitation is ready, but email delivery is not configured. Copy and share the link."
      : "The invitation is ready, but the email could not be delivered. Copy and share the link.",
    email,
    inviteUrl,
  };
}
