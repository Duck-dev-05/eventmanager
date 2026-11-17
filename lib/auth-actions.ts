"use server";

import { redirect } from "next/navigation";
import type { AuthState } from "./auth-types";
import { clearSessionCookie, setSessionCookie } from "./session-cookie";
import { requestIdentifier } from "./client-ip";
import { checkRateLimit, resetRateLimit, retryMessage } from "./rate-limit";
import { createUser, findUserByEmail, verifyPassword } from "./users";

function normalizeEmail(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnPath(value: FormDataEntryValue | null) {
  const path = text(value);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function signIn(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  // Throttle both the address and the client so password guessing is not free.
  const identifier = await requestIdentifier();
  const accountKey = `signin:${identifier}:${email}`;

  const ipLimit = checkRateLimit({
    key: `signin-ip:${identifier}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return { error: retryMessage(ipLimit.retryAfterSeconds), values: { email } };
  }

  const accountLimit = checkRateLimit({
    key: accountKey,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!accountLimit.allowed) {
    return {
      error: retryMessage(accountLimit.retryAfterSeconds),
      values: { email },
    };
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Email or password is incorrect.", values: { email } };
  }

  resetRateLimit(accountKey);
  await setSessionCookie(user);
  redirect(safeReturnPath(formData.get("next")));
}

export async function signUp(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = text(formData.get("name"));
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const values = { name, email };

  if (name.length < 2) {
    return { error: "Enter your name (at least 2 characters).", values };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", values };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", values };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match.", values };
  }
  if (await findUserByEmail(email)) {
    return { error: "An account with this email already exists.", values };
  }

  const user = await createUser({ name, email, password });
  await setSessionCookie(user);
  redirect(safeReturnPath(formData.get("next")));
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
