import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";

/** Coarse buckets used for icons and labels in the UI. */
export type ActivityKind = "event" | "member" | "task" | "file" | "agenda";

export type EventActivityEntry = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
};

type ActivityRow = {
  id: string;
  kind: string;
  summary: string;
  created_at: string;
  actor_name: string | null;
  actor_avatar_url: string | null;
};

/**
 * Records one thing that happened on an event. Logging must never break the
 * action that triggered it, so callers should treat this as best-effort.
 */
export async function logEventActivity({
  eventId,
  actorId,
  kind,
  summary,
}: {
  eventId: string;
  actorId: string | null;
  kind: ActivityKind;
  summary: string;
}): Promise<void> {
  const clean = summary.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!eventId || !clean) return;

  await (await getDb())
    .prepare(
      `INSERT INTO event_activity (id, event_id, actor_id, kind, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), eventId, actorId, kind, clean, new Date().toISOString());
}

export async function getEventActivity(
  eventId: string,
  limit = 50,
): Promise<EventActivityEntry[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT a.id, a.kind, a.summary, a.created_at,
              u.name AS actor_name, u.avatar_url AS actor_avatar_url
       FROM event_activity a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.event_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(eventId, Math.min(Math.max(limit, 1), 200)) as ActivityRow[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    createdAt: row.created_at,
    actorName: row.actor_name,
    actorAvatarUrl: row.actor_avatar_url,
  }));
}
