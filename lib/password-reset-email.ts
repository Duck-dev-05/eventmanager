import nodemailer from "nodemailer";

type PasswordResetEmailInput = {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
};

function textFor(input: PasswordResetEmailInput) {
  return [
    `Hi ${input.recipientName},`,
    "",
    "We received a request to reset your EventPulse password.",
    `Set a new password here: ${input.resetUrl}`,
    "",
    "This link expires in 60 minutes and can only be used once.",
    "If you did not ask for this, you can safely ignore this email.",
  ].join("\n");
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    return { sent: false as const, reason: "not-configured" as const };
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
      subject: "Reset your EventPulse password",
      text: textFor(input),
    });
    return { sent: true as const };
  } catch {
    return { sent: false as const, reason: "delivery-failed" as const };
  }
}
