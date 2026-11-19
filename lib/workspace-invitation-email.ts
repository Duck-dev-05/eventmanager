import nodemailer from "nodemailer";

type WorkspaceInviteInput = {
  recipientEmail: string;
  inviterName: string;
  inviteUrl: string;
};

export type WorkspaceInviteDelivery =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "delivery-failed" };

export async function sendWorkspaceInvitation(
  input: WorkspaceInviteInput,
): Promise<WorkspaceInviteDelivery> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    return { sent: false, reason: "not-configured" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_FROM || gmailUser,
      to: input.recipientEmail,
      subject: `${input.inviterName} invited you to join EventPulse`,
      text: [
        `Hi,`,
        "",
        `${input.inviterName} invited you to join them on EventPulse.`,
        "Create an account to join the workspace. You can be added to an event later.",
        "",
        `Join EventPulse: ${input.inviteUrl}`,
        "",
        "If you already have an account, sign in with this email address.",
      ].join("\n"),
      html: `<p>Hi,</p><p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join them on EventPulse.</p><p>Create an account to join the workspace. You can be added to an event later.</p><p><a href="${escapeHtml(input.inviteUrl)}">Join EventPulse</a></p><p>If you already have an account, sign in with this email address.</p>`,
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "delivery-failed" };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
