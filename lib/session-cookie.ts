import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
} from "./session.ts";
import { findUserByEmail } from "./users.ts";
import type { WorkspaceRole } from "./users.ts";

export async function setSessionCookie(user: {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}) {
  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  workspaceRole: WorkspaceRole;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await findUserByEmail(payload.email);

  // The account is the source of truth: deleting or renaming a user must end
  // their access immediately instead of trusting a cookie for up to 7 days.
  if (!user || user.id !== payload.userId) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    workspaceRole: user.workspaceRole,
  };
}