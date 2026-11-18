import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db.ts";

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
  | { mode: "snapshot"; cursor: number; events: unknown[]; members: SyncEventMember[] }
  | { mode: "changes"; cursor: number; changes: SyncChange[]; members: SyncEventMember[] }
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
       WHERE e.owner_id = ? AND em.status = 'accepted'
       ORDER BY em.event_id, em.invited_at, em.id`,
    )
    .all(device.userId)) as Array<{
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

  const needsSnapshot = cursor === 0 || cursor < bounds.min_seq;

  if (needsSnapshot) {
    const events = (await db
      .prepare(
        `SELECT ${eventColumns} FROM events WHERE owner_id = ?
         ORDER BY starts_at ASC`,
      )
      .all(device.userId)) as EventDbRow[];

    return { mode: "snapshot", cursor: bounds.max_seq, events, members: memberSnapshot };
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

  return { mode: "changes", cursor: cursorAfter, changes, members: memberSnapshot };
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
    if (!eventId || title.length < 1 || !startsAt) continue;

    const visibility =
      asString(event.visibility ?? "") === "public" ? "public" : "private";

    const row: EventDbRow = {
      id: eventId,
      owner_id: device.userId,
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
      userId: device.userId,
      deviceId: device.id,
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
