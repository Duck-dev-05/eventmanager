import nodemailer from "nodemailer";

type EventInviteEmailInput = {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
};

export type InviteDelivery =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "delivery-failed" };

function textFor(input: EventInviteEmailInput) {
  return [
    `Hi ${input.recipientName},`,
    "",
    `${input.inviterName} invited you to "${input.eventTitle}" on EventPulse as ${input.roleLabel}.`,
    "",
    `Accept the invitation here: ${input.inviteUrl}`,
    "",
    "This link expires in 14 days and only works for this email address.",
    "If you were not expecting it, you can ignore this email.",
  ].join("\n");
}

export async function sendEventInviteEmail(
  input: EventInviteEmailInput,
): Promise<InviteDelivery> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    return { sent: false, reason: "not-configured" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_FROM || gmailUser,
      to: input.recipientEmail,
      subject: `${input.inviterName} invited you to ${input.eventTitle}`,
      text: textFor(input),
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: "delivery-failed" };
  }
}
