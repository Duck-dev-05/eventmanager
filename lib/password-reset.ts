import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db.ts";

/** How long a reset link stays valid. */
const RESET_TTL_MINUTES = 60;

export type PasswordReset = {
  userId: string;
  name: string;
  email: string;
  expiresAt: string;
};

type ResetRow = {
  user_id: string;
  name: string;
  email: string;
  expires_at: string;
};

/**
 * Issues a single-use reset token. Any earlier unused token for the same user
 * is burned so only the newest email works.
 */
export async function createPasswordResetToken(userId: string) {
  const db = await getDb();
  const now = new Date();

  db.prepare(
    `UPDATE password_resets SET used_at = ?
     WHERE user_id = ? AND used_at IS NULL`,
  ).run(now.toISOString(), userId);

  const token = randomBytes(32).toString("base64url");

  db.prepare(
    `INSERT INTO password_resets (id, user_id, token, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
  ).run(
    randomUUID(),
    userId,
    token,
    new Date(now.getTime() + RESET_TTL_MINUTES * 60_000).toISOString(),
    now.toISOString(),
  );

  return token;
}

/** Looks up an unused, unexpired token together with its account. */
export async function findPasswordReset(
  token: string,
): Promise<PasswordReset | null> {
  if (!token) return null;

  const row = await (await getDb())
    .prepare(
      `SELECT pr.user_id, u.name, u.email, pr.expires_at
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = ?
         AND pr.used_at IS NULL
         AND pr.expires_at > ?`,
    )
    .get(token, new Date().toISOString()) as ResetRow | undefined;

  if (!row) return null;

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    expiresAt: row.expires_at,
  };
}

/**
 * Marks a token as used and returns its account. Returns null when the token
 * was already used, expired, or never existed.
 */
export async function consumePasswordReset(token: string) {
  const reset = await findPasswordReset(token);
  if (!reset) return null;

  const result = await (await getDb())
    .prepare(
      `UPDATE password_resets SET used_at = ?
       WHERE token = ? AND used_at IS NULL`,
    )
    .run(new Date().toISOString(), token);

  return result.changes > 0 ? reset : null;
}
