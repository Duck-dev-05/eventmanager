import { createPasswordResetToken } from "./password-reset.ts";
import { sendPasswordResetEmail } from "./password-reset-email.ts";
import type { ForgotPasswordState } from "./password-types.ts";
import { checkRateLimit, retryMessage } from "./rate-limit.ts";
import { findUserByEmail } from "./users.ts";

const NEUTRAL_MESSAGE =
  "If an account exists for that email, a reset link is on its way.";

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "";
}

export async function requestPasswordResetForEmail(
  email: string,
  identifier: string,
): Promise<ForgotPasswordState> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: "Enter the email address for your account." };
  }

  const limit = checkRateLimit({
    key: `reset:${identifier}:${normalizedEmail}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) return { success: NEUTRAL_MESSAGE };

  const token = await createPasswordResetToken(user.id);
  const base = appUrl();
  const resetUrl = base ? `${base}/reset-password/${token}` : "";
  const delivery = resetUrl
    ? await sendPasswordResetEmail({
        recipientEmail: user.email,
        recipientName: user.name,
        resetUrl,
      })
    : ({ sent: false as const, reason: "not-configured" as const });

  const canExposeLink =
    !delivery.sent &&
    process.env.NODE_ENV !== "production" &&
    resetUrl.length > 0;

  return canExposeLink
    ? { success: NEUTRAL_MESSAGE, devLink: resetUrl }
    : { success: NEUTRAL_MESSAGE };
}
