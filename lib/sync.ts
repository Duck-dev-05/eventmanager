import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { logEventActivity } from "./activity.ts";
import { getPreferences } from "./preferences.ts";

/**
 * Desktop app sync. The Tauri desktop app polls /api/sync/pull every few
 * seconds and pushes local mutations through /api/sync/push. Both endpoints
 * authenticate with a per-device bearer token created on this page.
 */

export type SyncDeviceRow = {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export type SyncDevice = {
  id: string;
  userId: string;
  name: string;
};

type DeviceDbRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function listSyncDevices(userId: string): Promise<SyncDeviceRow[]> {
  const rows = (await (await getDb())
    .prepare(
      `SELECT id, user_id, name, created_at, last_seen_at
       FROM sync_devices WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .all(userId)) as DeviceDbRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

/**
 * Creates a paired device and returns its bearer token. The plaintext token
 * is shown exactly once; only its hash is stored.
 */
export async function createSyncDevice(
  userId: string,
  name: string,
): Promise<{ id: string; userId: string; name: string; token: string; createdAt: string }> {
  const db = await getDb();
  const id = randomBytes(12).toString("hex");
  const token = `epds_${randomBytes(24).toString("hex")}`;
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO sync_devices (id, user_id, name, token_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, userId, name, sha256(token), createdAt);

  // A baseline changelog entry guarantees the snapshot cursor returned on
  // first pull is above zero, so later polls switch to incremental mode
  // instead of re-snapshotting while the workspace has no changes yet.
  await db
    .prepare(
      `INSERT INTO sync_changes
        (user_id, device_id, entity, action, entity_id, payload, created_at)
       VALUES (?, ?, 'baseline', 'created', ?, NULL, ?)`,
    )
    .run(userId, id, id, createdAt);

  return { id, userId, name, token, createdAt };
}

export async function deleteSyncDevice(userId: string, deviceId: string) {
  await (await getDb())
    .prepare("DELETE FROM sync_devices WHERE id = ? AND user_id = ?")
    .run(deviceId, userId);
}

/** Resolves the bearer token of a sync API request to a paired device. */
export async function authenticateSyncRequest(
  request: Request,
): Promise<SyncDevice | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.length < 16) return null;

  const row = (await (await getDb())
    .prepare(
      "SELECT id, user_id, name FROM sync_devices WHERE token_hash = ?",
    )
    .get(sha256(token))) as DeviceDbRow | undefined;

  if (!row) return null;

  await (await getDb())
    .prepare("UPDATE sync_devices SET last_seen_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);

  return { id: row.id, userId: row.user_id, name: row.name };
}

export type SyncChange = {
  seq: number;
  action: string;
  entityId: string;
  event: unknown | null;
};

export type SyncEventMember = {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  invitedAt: string;
  status: string;
};

export type SyncNotification = {
  id: string;
  userId: string;
  eventId: string | null;
  kind: string;
  title: string;
  message: string;
  linkUrl: string;
  readAt: string | null;
  createdAt: string;
};

export type SyncInvitation = {
  id: string;
  eventId: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  expiresAt: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  category: string;
  inviterName: string | null;
};

async function listDeviceInvitations(userId: string): Promise<SyncInvitation[]> {
  const db = await getDb();
  const account = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
  if (!account) return [];
  const rows = await db.prepare(
    `SELECT i.id, i.event_id, i.email, i.role, i.status, i.created_at, i.expires_at,
            e.title AS event_title, e.starts_at, e.venue, e.category, u.name AS inviter_name
     FROM event_invites i
     JOIN events e ON e.id = i.event_id
     LEFT JOIN users u ON u.id = i.invited_by
     WHERE lower(i.email) = lower(?)
       AND i.status IN ('pending', 'accepted', 'declined')
       AND (i.status <> 'pending' OR i.expires_at > ?)
     ORDER BY i.created_at DESC`,
  ).all(account.email, new Date().toISOString()) as Array<{
    id: string; event_id: string; email: string; role: string; status: "pending" | "accepted" | "declined";
    created_at: string; expires_at: string; event_title: string; starts_at: string; venue: string;
    category: string; inviter_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id, eventId: row.event_id, email: row.email, role: row.role, status: row.status,
    createdAt: row.created_at, expiresAt: row.expires_at, eventTitle: row.event_title,
    startsAt: row.starts_at, venue: row.venue, category: row.category, inviterName: row.inviter_name,
  }));
}

export async function respondToDeviceInvitation(
  device: SyncDevice,
  invitationId: string,
  response: "accept" | "decline",
): Promise<{ success: true; eventId: string } | { success: false; error: string }> {
  const db = await getDb();
  const account = await db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(device.userId) as
    | { id: string; email: string; name: string }
    | undefined;
  if (!account) return { success: false, error: "The paired account no longer exists." };

  const now = new Date().toISOString();
  const txn = await db.transaction();
  let eventId = "";
  try {
    const invite = await txn.prepare(
      `SELECT i.id, i.event_id, i.email, i.role, i.invited_by, i.status, i.expires_at,
              i.created_at, e.title
       FROM event_invites i JOIN events e ON e.id = i.event_id WHERE i.id = ?`,
    ).get(invitationId) as { id: string; event_id: string; email: string; role: string; invited_by: string; status: string; expires_at: string; created_at: string; title: string } | undefined;
    if (!invite || invite.email.trim().toLowerCase() !== account.email.trim().toLowerCase()) {
      await txn.rollback();
      return { success: false, error: "Invitation not found for this account." };
    }
    if (invite.status !== "pending" || new Date(invite.expires_at).getTime() <= Date.now()) {
      await txn.rollback();
      return { success: false, error: "This invitation has already been handled or has expired." };
    }
    eventId = invite.event_id;

    if (response === "accept") {
      await txn.prepare(
        `INSERT INTO event_members (id, event_id, user_id, role, invited_by, status, invited_at)
         VALUES (?, ?, ?, ?, ?, 'accepted', ?)
         ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'accepted', role = excluded.role`,
      ).run(randomUUID(), invite.event_id, account.id, invite.role, invite.invited_by, invite.created_at);
      await txn.prepare(
        "UPDATE event_invites SET status = 'accepted', accepted_at = ? WHERE id = ? AND status = 'pending'",
      ).run(now, invitationId);
    } else {
      await txn.prepare(
        "UPDATE event_invites SET status = 'declined', accepted_at = NULL, declined_at = ? WHERE id = ? AND status = 'pending'",
      ).run(now, invitationId);
    }
    await txn.commit();
  } catch (error) {
    await txn.rollback().catch(() => {});
    return { success: false, error: error instanceof Error ? error.message : "Could not update invitation." };
  }

  if (response === "accept") {
    await logEventActivity({ eventId, actorId: account.id, kind: "member", summary: `${account.name} joined the event` }).catch(() => {});
  }
  return { success: true, eventId };
}

/**
 * Appends an event mutation to the workspace changelog so paired desktop
 * apps pick it up. `deviceId` is null for changes made in the web app.
 */
export async function appendSyncChange(
  db: Awaited<ReturnType<typeof getDb>>,
  {
    userId,
    deviceId = null,
    action,
    eventId,
    event = null,
  }: {
    userId: string;
    deviceId?: string | null;
    action: "upsert" | "delete";
    eventId: string;
    event?: unknown | null;
  },
) {
  await db
    .prepare(
      `INSERT INTO sync_changes
        (user_id, device_id, entity, action, entity_id, payload, created_at)
       VALUES (?, ?, 'event', ?, ?, ?, ?)`,
    )
    .run(
      userId,
      deviceId,
      action,
      eventId,
      event === null ? null : JSON.stringify(event),
      new Date().toISOString(),
    );
}

type EventDbRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  starts_at: string;
  capacity: number | null;
  visibility: string | null;
  created_at: string;
};

const eventColumns =
  "id, owner_id, title, description, category, venue, starts_at, capacity, visibility, created_at";

const MAX_PULL_CHANGES = 500;
const CHANGE_RETENTION_DAYS = 30;

/**
 * Returns changes since `cursor`. When the cursor is unknown (first connect,
 * or pruned history) a full snapshot of the user's events is returned instead
 * so the desktop app can bootstrap itself.
 */
export async function pullSyncChanges(
  device: SyncDevice,
  cursor: number,
): Promise<
  | { mode: "snapshot"; cursor: number; events: unknown[]; sharedEvents: unknown[]; members: SyncEventMember[]; invitations: SyncInvitation[]; notifications: SyncNotification[]; preferences: Awaited<ReturnType<typeof getPreferences>>; profile: { name: string; avatarUrl: string | null } }
  | { mode: "changes"; cursor: number; changes: SyncChange[]; sharedEvents: unknown[]; members: SyncEventMember[]; invitations: SyncInvitation[]; notifications: SyncNotification[]; preferences: Awaited<ReturnType<typeof getPreferences>>; profile: { name: string; avatarUrl: string | null } }
> {
  const db = await getDb();

  const bounds = (await db
    .prepare(
      `SELECT COALESCE(MIN(seq), 0) AS min_seq, COALESCE(MAX(seq), 0) AS max_seq
       FROM sync_changes WHERE user_id = ?`,
    )
    .get(device.userId)) as { min_seq: number; max_seq: number };

  const members = (await db
    .prepare(
      `SELECT em.id, em.event_id, em.user_id, u.name, u.email, u.avatar_url,
              em.role, em.invited_at, em.status
       FROM event_members em
       JOIN events e ON e.id = em.event_id
       JOIN users u ON u.id = em.user_id
       WHERE (e.owner_id = ? OR EXISTS (
         SELECT 1 FROM event_members access_member
         WHERE access_member.event_id = e.id AND access_member.user_id = ? AND access_member.status = 'accepted'
       )) AND em.status = 'accepted'
       ORDER BY em.event_id, em.invited_at, em.id`,
    )
    .all(device.userId, device.userId)) as Array<{
    id: string;
    event_id: string;
    user_id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    invited_at: string;
    status: string;
  }>;
  const memberSnapshot: SyncEventMember[] = members.map((member) => ({
    id: member.id,
    eventId: member.event_id,
    userId: member.user_id,
    name: member.name,
    email: member.email,
    avatarUrl: member.avatar_url,
    role: member.role,
    invitedAt: member.invited_at,
    status: member.status,
  }));

  const invitations = await listDeviceInvitations(device.userId);
  const preferences = await getPreferences(device.userId);
  const account = await db.prepare("SELECT name,avatar_url FROM users WHERE id=?").get(device.userId) as { name: string; avatar_url: string | null } | undefined;
  const profile = { name: account?.name ?? "", avatarUrl: account?.avatar_url ?? null };
  const notifications = (await db.prepare(
    `SELECT id, user_id, event_id, kind, title, message, link_url, read_at, created_at
     FROM event_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).all(device.userId)) as Array<{
    id: string; user_id: string; event_id: string | null; kind: string; title: string;
    message: string; link_url: string; read_at: string | null; created_at: string;
  }>;
  const notificationSnapshot: SyncNotification[] = notifications.map((row) => ({
    id: row.id, userId: row.user_id, eventId: row.event_id, kind: row.kind,
    title: row.title, message: row.message, linkUrl: row.link_url, readAt: row.read_at,
    createdAt: row.created_at,
  }));
  const sharedEvents = (await db.prepare(
    `SELECT e.id, e.owner_id, e.title, e.description, e.category, e.venue,
            e.starts_at, e.capacity, e.visibility, e.created_at
     FROM events e
     JOIN event_members em ON em.event_id = e.id
     WHERE em.user_id = ? AND em.status = 'accepted' AND e.owner_id <> ?
     ORDER BY e.starts_at ASC`,
  ).all(device.userId, device.userId)) as EventDbRow[];
  const needsSnapshot = cursor === 0 || cursor < bounds.min_seq;

  if (needsSnapshot) {
    const events = (await db
      .prepare(
        `SELECT ${eventColumns} FROM events WHERE owner_id = ?
         ORDER BY starts_at ASC`,
      )
      .all(device.userId)) as EventDbRow[];

    return { mode: "snapshot", cursor: bounds.max_seq, events, sharedEvents, members: memberSnapshot, invitations, notifications: notificationSnapshot, preferences, profile };
  }

  const rows = (await db
    .prepare(
      `SELECT seq, action, entity_id, payload
       FROM sync_changes
       WHERE user_id = ? AND seq > ? AND (device_id IS NULL OR device_id <> ?)
       ORDER BY seq ASC LIMIT ${MAX_PULL_CHANGES}`,
    )
    .all(device.userId, cursor, device.id)) as Array<{
    seq: number;
    action: string;
    entity_id: string;
    payload: string | null;
  }>;

  const changes = rows.map((row) => ({
    seq: row.seq,
    action: row.action,
    entityId: row.entity_id,
    event: row.payload ? JSON.parse(row.payload) : null,
  }));

  const cursorAfter =
    rows.length === MAX_PULL_CHANGES ? rows[rows.length - 1].seq : bounds.max_seq;

  return { mode: "changes", cursor: cursorAfter, changes, sharedEvents, members: memberSnapshot, invitations, notifications: notificationSnapshot, preferences, profile };
}

export type PushedChange = {
  id: string;
  action: string;
  event: {
    id?: string;
    title?: unknown;
    description?: unknown;
    category?: unknown;
    venue?: unknown;
    startsAt?: unknown;
    starts_at?: unknown;
    capacity?: unknown;
    visibility?: unknown;
    createdAt?: unknown;
    created_at?: unknown;
  } | null;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeCapacity(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Applies changes pushed from the desktop app and records them in the
 * changelog so the web app and other devices stay in sync.
 */
export async function pushSyncChanges(
  device: SyncDevice,
  changes: PushedChange[],
): Promise<{ accepted: number }> {
  const db = await getDb();
  let accepted = 0;

  for (const change of changes.slice(0, MAX_PULL_CHANGES)) {
    const action = change.action === "delete" ? "delete" : "upsert";

    if (action === "delete") {
      // Deletes use the event id the desktop app saw; scope to the paired
      // user so a stale token cannot delete someone else's event.
      const eventId = asString(change.event?.id ?? "");
      if (!eventId) continue;

      const removed = await db
        .prepare("DELETE FROM events WHERE id = ? AND owner_id = ?")
        .run(eventId, device.userId);

      if (removed.changes > 0) {
        await appendSyncChange(db, {
          userId: device.userId,
          deviceId: device.id,
          action: "delete",
          eventId,
        });
        accepted++;
      }
      continue;
    }

    const event = change.event ?? {};
    const eventId = asString(event.id ?? "");
    const title = asString(event.title ?? "").trim();
    const startsAt = asString(event.startsAt ?? event.starts_at ?? "");
    if (!eventId || title.length < 3 || title.length > 160 || !startsAt) continue;

    const existing = (await db
      .prepare("SELECT owner_id, visibility FROM events WHERE id = ?")
      .get(eventId)) as { owner_id: string; visibility: string | null } | undefined;
    let ownerId = device.userId;
    if (existing) {
      ownerId = existing.owner_id;
      if (ownerId !== device.userId) {
        const membership = (await db
          .prepare("SELECT role FROM event_members WHERE event_id = ? AND user_id = ? AND status = 'accepted'")
          .get(eventId, device.userId)) as { role: string } | undefined;
        if (membership?.role !== "admin") continue;
      }
    }

    const requestedVisibility = asString(event.visibility ?? "");
    const visibility = requestedVisibility === "public" || requestedVisibility === "private"
      ? requestedVisibility
      : existing?.visibility === "public" ? "public" : "private";

    const row: EventDbRow = {
      id: eventId,
      owner_id: ownerId,
      title,
      description: asString(event.description ?? ""),
      category: asString(event.category ?? "", "Other"),
      venue: asString(event.venue ?? ""),
      starts_at: startsAt,
      capacity: normalizeCapacity(event.capacity),
      visibility,
      created_at: asString(event.createdAt ?? event.created_at ?? new Date().toISOString()),
    };

    await db
      .prepare(
        `INSERT INTO events (${eventColumns})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           owner_id = excluded.owner_id,
           title = excluded.title,
           description = excluded.description,
           category = excluded.category,
           venue = excluded.venue,
           starts_at = excluded.starts_at,
           capacity = excluded.capacity,
           visibility = excluded.visibility,
           created_at = excluded.created_at`,
      )
      .run(
        row.id,
        row.owner_id,
        row.title,
        row.description,
        row.category,
        row.venue,
        row.starts_at,
        row.capacity,
        row.visibility,
        row.created_at,
      );

    await appendSyncChange(db, {
      userId: row.owner_id,
      deviceId: row.owner_id === device.userId ? device.id : null,
      action: "upsert",
      eventId: row.id,
      event: row,
    });

    accepted++;
  }

  await pruneSyncChanges(device.userId);

  return { accepted };
}

/** Drops changelog entries older than the retention window. */
async function pruneSyncChanges(userId: string) {
  const cutoff = new Date(
    Date.now() - CHANGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await (await getDb())
    .prepare(
      `DELETE FROM sync_changes
       WHERE user_id = ? AND created_at < ?
         AND seq <= COALESCE(
           (SELECT MIN(last_seq) FROM sync_acks a
            JOIN sync_devices d ON d.id = a.device_id
            WHERE d.user_id = ?), 0)`,
    )
    .run(userId, cutoff, userId);
}

/** Records how far a device has consumed the changelog. */
export async function acknowledgeSyncCursor(deviceId: string, cursor: number) {
  await (await getDb())
    .prepare(
      `INSERT INTO sync_acks (device_id, last_seq) VALUES (?, ?)
       ON CONFLICT(device_id) DO UPDATE SET last_seq = excluded.last_seq`,
    )
    .run(deviceId, Math.max(0, Math.floor(cursor)));
}
