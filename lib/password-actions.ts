"use server";

import {
  consumePasswordReset,
  createPasswordResetToken,
} from "./password-reset.ts";
import { sendPasswordResetEmail } from "./password-reset-email.ts";
import type { ForgotPasswordState, ResetPasswordState } from "./password-types.ts";
import { requestIdentifier } from "./client-ip.ts";
import { checkRateLimit, retryMessage } from "./rate-limit.ts";
import { findUserByEmail, updateUserPassword } from "./users.ts";

const NEUTRAL_MESSAGE =
  "If an account exists for that email, a reset link is on its way.";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "";
}

export async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = text(formData.get("email")).toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter the email address for your account." };
  }

  const identifier = await requestIdentifier();
  const limit = checkRateLimit({
    key: `reset:${identifier}:${email}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const user = await findUserByEmail(email);

  // Unknown addresses get the same answer so the form cannot be used to probe
  // which emails have accounts.
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

  if (canExposeLink) {
    return {
      success: NEUTRAL_MESSAGE,
      devLink: resetUrl,
    };
  }

  return { success: NEUTRAL_MESSAGE };
}

export async function resetPassword(
  _state: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = text(formData.get("token"));
  const password = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "This reset link is missing its token. Request a new one." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const reset = await consumePasswordReset(token);
  if (!reset) {
    return {
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const updated = await updateUserPassword(reset.userId, password);
  if (!updated) {
    return { error: "That account could not be updated. Request a new link." };
  }

  return {
    success: "Your password has been updated. You can now sign in with it.",
  };
}
