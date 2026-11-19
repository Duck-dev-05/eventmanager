"use server";

import { consumePasswordReset } from "./password-reset.ts";
import type { ForgotPasswordState, ResetPasswordState } from "./password-types.ts";
import { requestIdentifier } from "./client-ip.ts";
import { requestPasswordResetForEmail } from "./password-reset-service.ts";
import { updateUserPassword } from "./users.ts";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = text(formData.get("email"));
  const identifier = await requestIdentifier();
  return requestPasswordResetForEmail(email, identifier);
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
