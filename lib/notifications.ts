import { getDb } from "./db";

const NOTIFICATION_LIMITS: Record<number, number> = {
  1: 5,
  5: 20,
  10: 50,
};

export type Notification = {
  id: string;
  eventId: string | null;
  kind: string;
  title: string;
  message: string;
  linkUrl: string;
  readAt: string | null;
  createdAt: string;
};

export async function createNotification(params: {
  userId: string;
  eventId?: string;
  kind: string;
  title: string;
  message: string;
  linkUrl?: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO event_notifications
       (id, user_id, event_id, kind, title, message, link_url, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    id,
    params.userId,
    params.eventId ?? null,
    params.kind,
    params.title,
    params.message,
    params.linkUrl ?? "",
    now,
  );
}

export async function listNotificationsForUser(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const db = getDb();
  const limitRow = NOTIFICATION_LIMITS[limit] ?? limit;
  const rows = db
    .prepare(
      `SELECT id, event_id, kind, title, message, link_url, read_at,
              created_at
       FROM event_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(userId, limitRow) as Array<{
    id: string;
    event_id: string | null;
    kind: string;
    title: string;
    message: string;
    link_url: string;
    read_at: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    kind: row.kind,
    title: row.title,
    message: row.message,
    linkUrl: row.link_url,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM event_notifications
       WHERE user_id = ? AND read_at IS NULL`,
    )
    .get(userId) as { count: number } | undefined;

  return row?.count ?? 0;
}

export async function markNotificationAsRead(params: {
  notificationId: string;
  userId: string;
}) {
  const db = getDb();

  db.prepare(
    `UPDATE event_notifications
     SET read_at = ?
     WHERE id = ? AND user_id = ?
       AND read_at IS NULL`,
  ).run(new Date().toISOString(), params.notificationId, params.userId);
}

export async function markAllNotificationsAsRead(userId: string) {
  const db = getDb();

  db.prepare(
    `UPDATE event_notifications
     SET read_at = ?
     WHERE user_id = ? AND read_at IS NULL`,
  ).run(new Date().toISOString(), userId);
}
