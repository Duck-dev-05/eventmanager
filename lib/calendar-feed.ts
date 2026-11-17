import { randomBytes } from "node:crypto";
import { getDb } from "./db.ts";

export type FeedOwner = { id: string; name: string; email: string };

/**
 * Calendar apps cannot sign in, so each user gets an unguessable token that
 * identifies their personal feed. Rotating it invalidates old subscriptions.
 */
export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT calendar_token FROM users WHERE id = ?")
    .get(userId) as { calendar_token: string | null } | undefined;

  if (row?.calendar_token) return row.calendar_token;

  const token = randomBytes(24).toString("base64url");
  db.prepare("UPDATE users SET calendar_token = ? WHERE id = ?").run(
    token,
    userId,
  );

  return token;
}

export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await (await getDb())
    .prepare("UPDATE users SET calendar_token = ? WHERE id = ?")
    .run(token, userId);

  return token;
}

export async function findFeedOwner(token: string): Promise<FeedOwner | null> {
  if (!token || token.length < 16) return null;

  const row = await (await getDb())
    .prepare(
      "SELECT id, name, email FROM users WHERE calendar_token = ? LIMIT 1",
    )
    .get(token) as FeedOwner | undefined;

  return row ?? null;
}

export function calendarFeedUrl(token: string) {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  const path = `/api/calendar/${token}`;
  return base ? `${base}${path}` : path;
}
