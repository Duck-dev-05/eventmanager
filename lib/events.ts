import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { deleteObject } from "./storage.ts";
import { appendSyncChange } from "./sync.ts";
import {
  isAssignableRole,
  normalizeRole,
  rolePermissions,
  type EventRole,
} from "./roles.ts";
import { getSessionUser } from "./session-cookie.ts";

export type EventVisibility = "private" | "public";

export type EventRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  capacity: number | null;
  /** Private events are member-only; public ones open read-only to the workspace. */
  visibility: EventVisibility;
  createdAt: string;
};

/** Only the two documented values are accepted; anything else keeps the old one. */
function normalizeVisibility(
  value: string | null | undefined,
): EventVisibility | null {
  if (value === "public") return "public";
  if (value === "private") return "private";
  return null;
}

export type EventStatus = "Upcoming" | "Past";

/** An event counts as past as soon as its start time has gone by. */
export function eventStatus(startsAt: string, now = Date.now()): EventStatus {
  return new Date(startsAt).getTime() < now ? "Past" : "Upcoming";
}

type EventRow = {
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

const columns =
  "id, owner_id, title, description, category, venue, starts_at, capacity, visibility, created_at";

function toEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    category: row.category,
    venue: row.venue,
    startsAt: row.starts_at,
    capacity: row.capacity,
    visibility: row.visibility === "public" ? "public" : "private",
    createdAt: row.created_at,
  };
}

export async function createEvent({
  ownerId,
  title,
  description,
  category,
  venue,
  startsAt,
  capacity,
}: {
  ownerId: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  capacity: number | null;
}) {
  const event: EventRecord = {
    id: randomUUID(),
    ownerId,
    title,
    description,
    category,
    venue,
    startsAt,
    capacity,
    visibility: "private",
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();

  await db
    .prepare(
      `INSERT INTO events
        (id, owner_id, title, description, category, venue, starts_at, capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      event.ownerId,
      event.title,
      event.description,
      event.category,
      event.venue,
      event.startsAt,
      event.capacity,
      event.createdAt,
    );

  // Paired desktop apps poll this changelog.
  await appendSyncChange(db, {
    userId: event.ownerId,
    action: "upsert",
    eventId: event.id,
    event: {
      id: event.id,
      owner_id: event.ownerId,
      title: event.title,
      description: event.description,
      category: event.category,
      venue: event.venue,
      starts_at: event.startsAt,
      capacity: event.capacity,
      visibility: event.visibility,
      created_at: event.createdAt,
    },
  });

  return event;
}

export async function updateEvent({
  eventId,
  actorId,
  title,
  description,
  category,
  venue,
  startsAt,
  capacity,
  visibility,
}: {
  eventId: string;
  actorId: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  capacity: number | null;
  visibility?: string;
}) {
  const allowed = await canManageEvent(eventId, actorId);
  if (!allowed) {
    return { success: false, error: "You cannot edit this event." };
  }

  const nextVisibility = normalizeVisibility(visibility);

  const db = await getDb();

  await db
    .prepare(
      `UPDATE events
       SET title = ?, description = ?, category = ?, venue = ?, starts_at = ?, capacity = ?,
           visibility = COALESCE(?, visibility)
       WHERE id = ?`,
    )
    .run(
      title,
      description,
      category,
      venue,
      startsAt,
      capacity,
      nextVisibility,
      eventId,
    );

  const row = (await db
    .prepare(`SELECT ${columns} FROM events WHERE id = ?`)
    .get(eventId)) as EventRow | undefined;
  if (row) {
    await appendSyncChange(db, {
      userId: row.owner_id,
      action: "upsert",
      eventId,
      event: row,
    });
  }

  return { success: true };
}

export async function deleteEvent({
  eventId,
  actorId,
}: {
  eventId: string;
  actorId: string;
}) {
  const db = await getDb();
  const row = await db
    .prepare("SELECT owner_id FROM events WHERE id = ?")
    .get(eventId) as { owner_id: string } | undefined;

  if (!row) {
    return { success: false, error: "Event not found." };
  }
  if (row.owner_id !== actorId) {
    return { success: false, error: "Only the event owner can delete this event." };
  }

  // The files row references are read first so the stored objects can be
  // deleted after the DB rows are gone.
  const fileRows = (await db
    .prepare("SELECT storage_key FROM event_files WHERE event_id = ?")
    .all(eventId)) as Array<{ storage_key: string }>;

  await db.batch([
    { sql: "DELETE FROM event_files WHERE event_id = ?", args: [eventId] },
    { sql: "DELETE FROM event_tasks WHERE event_id = ?", args: [eventId] },
    { sql: "DELETE FROM event_invites WHERE event_id = ?", args: [eventId] },
    { sql: "DELETE FROM event_members WHERE event_id = ?", args: [eventId] },
    { sql: "DELETE FROM events WHERE id = ?", args: [eventId] },
  ]);

  await appendSyncChange(db, {
    userId: row.owner_id,
    action: "delete",
    eventId,
  });

  for (const file of fileRows) {
    await deleteObject(file.storage_key).catch(() => {});
  }

  return { success: true };
}

export async function getEventOwner(eventId: string) {
  const row = await (await getDb())
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url
       FROM events e
       JOIN users u ON u.id = e.owner_id
       WHERE e.id = ?`,
    )
    .get(eventId) as
    | { id: string; name: string; email: string; avatar_url: string | null }
    | undefined;

  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
      }
    : null;
}

export async function findEventForOwner(id: string, ownerId: string) {
  const row = await (await getDb())
    .prepare(`SELECT ${columns} FROM events WHERE id = ? AND owner_id = ?`)
    .get(id, ownerId) as EventRow | undefined;

  return row ? toEvent(row) : null;
}

export async function listEventsForOwner(ownerId: string) {
  const rows = await (await getDb())
    .prepare(
      `SELECT ${columns} FROM events WHERE owner_id = ? ORDER BY starts_at ASC`,
    )
    .all(ownerId) as EventRow[];

  return rows.map(toEvent);
}

const qualifiedColumns =
  "e.id, e.owner_id, e.title, e.description, e.category, e.venue, e.starts_at, e.capacity, e.visibility, e.created_at";

/**
 * Shared events open to their owner and accepted members. Public events are
 * unlisted but readable by anyone signed in to the workspace who has the link.
 */
export async function findEventForUser(id: string, userId: string) {
  const row = await (await getDb())
    .prepare(
      `SELECT ${qualifiedColumns}
       FROM events e
       WHERE e.id = ?
         AND (
           e.owner_id = ?
           OR e.visibility = 'public'
           OR EXISTS (
             SELECT 1 FROM event_members em
             WHERE em.event_id = e.id
               AND em.user_id = ?
               AND em.status = 'accepted'
           )
         )`,
    )
    .get(id, userId, userId) as EventRow | undefined;

  return row ? toEvent(row) : null;
}

/** The caller's role on an event, or null when they have no access. */
export async function getEventRole(
  eventId: string,
  userId: string,
): Promise<EventRole | null> {
  const row = await (await getDb())
    .prepare(
      `SELECT e.owner_id AS owner_id, em.role AS role
       FROM events e
       LEFT JOIN event_members em
         ON em.event_id = e.id
        AND em.user_id = ?
        AND em.status = 'accepted'
       WHERE e.id = ?`,
    )
    .get(userId, eventId) as
    | { owner_id: string; role: string | null }
    | undefined;

  if (!row) return null;
  if (row.owner_id === userId) return "owner";
  if (!row.role) return null;

  return normalizeRole(row.role);
}

/** Owner and admins can invite, remove and manage the team. */
export async function canManageEvent(eventId: string, userId: string) {
  const role = await getEventRole(eventId, userId);
  return role !== null && rolePermissions(role).canManageTeam;
}

/** Event title for notification copy, or null when the event is gone. */
export async function getEventTitle(eventId: string) {
  const row = await (await getDb())
    .prepare(`SELECT title FROM events WHERE id = ?`)
    .get(eventId) as { title: string } | undefined;

  return row?.title ?? null;
}

/** Lists every event a user owns or has joined. */
export async function listEventsForUser(userId: string) {
  const rows = await (await getDb())
    .prepare(
      `SELECT ${qualifiedColumns}
       FROM events e
       WHERE e.owner_id = ?
         OR EXISTS (
           SELECT 1 FROM event_members em
           WHERE em.event_id = e.id
             AND em.user_id = ?
             AND em.status = 'accepted'
         )
       ORDER BY e.starts_at ASC`,
    )
    .all(userId, userId) as EventRow[];

  return rows.map(toEvent);
}

/** Counts the distinct people collaborating on events a user owns. */
export async function countEventMembersForOwner(ownerId: string) {
  const row = await (await getDb())
    .prepare(
      `SELECT COUNT(DISTINCT em.user_id) AS count
       FROM event_members em
       JOIN events e ON e.id = em.event_id
       WHERE e.owner_id = ? AND em.status = 'accepted'`,
    )
    .get(ownerId) as { count: number } | undefined;

  return row?.count ?? 0;
}

export type ActivityEntry = {
  kind: "created" | "joined";
  eventId: string;
  title: string;
  at: string;
};

/** Recent event activity for a user: events they created or joined. */
export async function listActivityForUser(
  userId: string,
  limit = 30,
): Promise<ActivityEntry[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT 'created' AS kind, e.id AS event_id, e.title, e.created_at AS at
       FROM events e
       WHERE e.owner_id = ?
       UNION ALL
       SELECT 'joined' AS kind, e.id AS event_id, e.title, em.invited_at AS at
       FROM event_members em
       JOIN events e ON e.id = em.event_id
       WHERE em.user_id = ? AND em.status = 'accepted'
       ORDER BY at DESC
       LIMIT ?`,
    )
    .all(userId, userId, limit) as Array<{
    kind: "created" | "joined";
    event_id: string;
    title: string;
    at: string;
  }>;

  return rows.map((row) => ({
    kind: row.kind,
    eventId: row.event_id,
    title: row.title,
    at: row.at,
  }));
}

export type EventMember = {
  id: string;
  name: string;
  email: string;
  role: EventRole;
  invitedAt: string;
  status: string;
  avatarUrl?: string | null;
};

export async function getEventMembers(eventId: string): Promise<EventMember[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url, em.role, em.invited_at, em.status
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.event_id = ? AND em.status = 'accepted'
       ORDER BY em.invited_at ASC`,
    )
    .all(eventId) as Array<{
      id: string;
      name: string;
      email: string;
      avatar_url: string | null;
      role: string;
      invited_at: string;
      status: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: normalizeRole(row.role),
    invitedAt: row.invited_at,
    status: row.status,
  }));
}

export type EventInvitation = {
  id: string;
  email: string;
  role: EventRole;
  invitedAt: string;
  expiresAt: string;
  /** Filled in when the invited email already belongs to an account. */
  name?: string;
  avatarUrl?: string | null;
};

export async function getEventInvitations(
  eventId: string,
): Promise<EventInvitation[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT ei.id, ei.email, ei.role, ei.created_at, ei.expires_at,
              u.name AS invitee_name, u.avatar_url AS invitee_avatar_url
       FROM event_invites ei
       LEFT JOIN users u ON lower(u.email) = lower(ei.email)
       WHERE ei.event_id = ? AND ei.status = 'pending'
       ORDER BY ei.created_at ASC`,
    )
    .all(eventId) as Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    expires_at: string;
    invitee_name: string | null;
    invitee_avatar_url: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: normalizeRole(row.role),
    invitedAt: row.created_at,
    expiresAt: row.expires_at,
    name: row.invitee_name ?? undefined,
    avatarUrl: row.invitee_avatar_url ?? undefined,
  }));
}

export type IncomingInvite = {
  id: string;
  token: string;
  role: EventRole;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  expiresAt: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  category: string;
  inviterName: string | null;
};

/**
 * Every invitation addressed to one email, for the invitee's inbox tabs.
 * Expired pending invitations are dropped; answered ones are kept as history.
 */
export async function listInvitesForEmail(
  email: string,
): Promise<IncomingInvite[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT ei.id, ei.token, ei.role, ei.status, ei.created_at, ei.expires_at,
              e.id AS event_id, e.title, e.starts_at, e.venue, e.category,
              u.name AS inviter_name
       FROM event_invites ei
       JOIN events e ON e.id = ei.event_id
       LEFT JOIN users u ON u.id = ei.invited_by
       WHERE lower(ei.email) = lower(?)
         AND ei.status IN ('pending', 'accepted', 'declined')
         AND (ei.status <> 'pending' OR ei.expires_at > ?)
       ORDER BY ei.created_at DESC`,
    )
    .all(email, new Date().toISOString()) as Array<{
    id: string;
    token: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
    event_id: string;
    title: string;
    starts_at: string;
    venue: string;
    category: string;
    inviter_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    role: normalizeRole(row.role),
    status:
      row.status === "accepted" || row.status === "declined"
        ? row.status
        : "pending",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    eventId: row.event_id,
    eventTitle: row.title,
    startsAt: row.starts_at,
    venue: row.venue,
    category: row.category,
    inviterName: row.inviter_name,
  }));
}

export async function createEventInvite({
  eventId,
  email,
  inviterId,
  role = "member",
}: {
  eventId: string;
  email: string;
  inviterId: string;
  role?: string;
}): Promise<
  | { success: true; inviteToken: string }
  | { success: false; error: string }
> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const event = await db
    .prepare(`SELECT owner_id FROM events WHERE id = ?`)
    .get(eventId) as { owner_id: string } | undefined;

  if (!event) return { success: false, error: "This event no longer exists." };

  const inviterRole = await getEventRole(eventId, inviterId);
  if (inviterRole === null || !rolePermissions(inviterRole).canManageTeam) {
    return {
      success: false,
      error: "Only the event owner and admins can invite people.",
    };
  }

  if (!isAssignableRole(role)) {
    return { success: false, error: "That role does not exist." };
  }

  db.prepare(
    `UPDATE event_invites
     SET status = 'expired'
     WHERE event_id = ? AND email = ? AND status = 'pending' AND expires_at <= ?`,
  ).run(eventId, normalizedEmail, new Date().toISOString());

  const acceptedMember = await db
    .prepare(
      `SELECT 1
       FROM event_members em
       JOIN users u ON u.id = em.user_id
       WHERE em.event_id = ? AND u.email = ? AND em.status = 'accepted'`,
    )
    .get(eventId, normalizedEmail);
  if (acceptedMember) {
    return { success: false, error: "This person already has access to this event." };
  }

  const existingInvite = await db
    .prepare(
      `SELECT 1 FROM event_invites
       WHERE event_id = ? AND email = ? AND status = 'pending'`,
    )
    .get(eventId, normalizedEmail);
  if (existingInvite) {
    return { success: false, error: "This email already has a pending invitation." };
  }

  const inviteToken = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  db.prepare(
    `INSERT INTO event_invites
      (id, event_id, email, invited_by, token, status, expires_at, created_at, role)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    randomUUID(),
    eventId,
    normalizedEmail,
    inviterId,
    inviteToken,
    expiresAt,
    createdAt,
    role,
  );

  return { success: true, inviteToken };
}

export type EventInvite = {
  eventId: string;
  eventTitle: string;
  invitedEmail: string;
  role: EventRole;
  expiresAt: string;
  inviterName?: string;
  inviterAvatarUrl?: string;
};

export async function findEventInvite(token: string): Promise<EventInvite | null> {
  const row = await (await getDb())
    .prepare(
      `SELECT e.id AS event_id, e.title AS event_title, ei.email, ei.role,
              ei.expires_at, u.name AS inviter_name, u.avatar_url AS inviter_avatar_url
       FROM event_invites ei
       JOIN events e ON e.id = ei.event_id
       LEFT JOIN users u ON u.id = ei.invited_by
       WHERE ei.token = ? AND ei.status = 'pending'`,
    )
    .get(token) as
    | {
        event_id: string;
        event_title: string;
        email: string;
        role: string;
        expires_at: string | null;
        inviter_name: string | null;
        inviter_avatar_url: string | null;
      }
    | undefined;

  if (
    !row?.expires_at ||
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  return {
    eventId: row.event_id,
    eventTitle: row.event_title,
    invitedEmail: row.email,
    role: normalizeRole(row.role),
    expiresAt: row.expires_at,
    inviterName: row.inviter_name ?? undefined,
    inviterAvatarUrl: row.inviter_avatar_url ?? undefined,
  };
}

export async function acceptEventInvite({
  token,
  userId,
  userEmail,
}: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ success: true; eventId: string } | { success: false; error: string }> {
  const invite = await findEventInvite(token);
  if (!invite) {
    return { success: false, error: "This invitation is invalid or has expired." };
  }
  if (invite.invitedEmail !== userEmail.trim().toLowerCase()) {
    return { success: false, error: "Sign in with the email address that received this invitation." };
  }

  const db = await getDb();
  const txn = await db.transaction();
  try {
    const accepted = await txn
      .prepare(
        `INSERT INTO event_members
          (id, event_id, user_id, role, invited_by, status, invited_at)
         SELECT ?, event_id, ?, role, invited_by, 'accepted', created_at
         FROM event_invites WHERE token = ? AND status = 'pending'
         ON CONFLICT (event_id, user_id)
           DO UPDATE SET status = 'accepted', role = excluded.role`,
      )
      .run(randomUUID(), userId, token);

    if (accepted.changes === 0) {
      await txn.rollback();
      return {
        success: false,
        error: "This invitation has already been used or is no longer available.",
      };
    }

    await txn
      .prepare(
        `UPDATE event_invites
         SET status = 'accepted', accepted_at = ?
         WHERE token = ? AND status = 'pending'`,
      )
      .run(new Date().toISOString(), token);
    await txn.commit();
  } catch {
    await txn.rollback().catch(() => {});
    return { success: false, error: "This invitation could not be accepted." };
  }

  return { success: true, eventId: invite.eventId };
}

export async function declineEventInvite(
  token: string,
  userEmail: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const invite = await findEventInvite(token);
  if (!invite) {
    return { success: false, error: "This invitation is invalid or has expired." };
  }
  if (invite.invitedEmail !== userEmail.trim().toLowerCase()) {
    return {
      success: false,
      error: "Sign in with the email address that received this invitation.",
    };
  }

  await (await getDb())
    .prepare(
      `UPDATE event_invites
       SET status = 'declined', accepted_at = NULL
       WHERE token = ? AND status = 'pending'`,
    )
    .run(token);

  return { success: true };
}

export async function declineEventInviteById(
  inviteId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const db = await getDb();
  const invite = await db
    .prepare(
      `SELECT email, event_id FROM event_invites
       WHERE id = ? AND status = 'pending'`,
    )
    .get(inviteId) as { email: string; event_id: string } | undefined;

  if (!invite) {
    return { success: false, error: "Invitation not found or already processed." };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "You must be signed in." };
  }

  const isInvitee = user.email.trim().toLowerCase() === invite.email.trim().toLowerCase();

  let canManage = false;
  if (!isInvitee) {
    const role = await getEventRole(invite.event_id, user.id);
    canManage = role !== null && rolePermissions(role).canManageTeam;
  }

  if (!isInvitee && !canManage) {
    return {
      success: false,
      error: "You are not authorized to cancel this invitation.",
    };
  }

  db.prepare(
    `UPDATE event_invites SET status = 'declined' WHERE id = ? AND status = 'pending'`,
  ).run(inviteId);

  return { success: true };
}

/**
 * Re-issues a pending invitation: extends its expiry and returns the link so
 * the caller can email it again. The token itself stays the same.
 */
export async function resendEventInvite({
  inviteId,
  actorId,
}: {
  inviteId: string;
  actorId: string;
}): Promise<
  | {
      success: true;
      eventId: string;
      email: string;
      role: EventRole;
      eventTitle: string;
      invitePath: string;
    }
  | { success: false; error: string }
> {
  const db = await getDb();
  const invite = await db
    .prepare(
      `SELECT ei.id, ei.event_id, ei.email, ei.role, ei.token,
              e.title AS event_title
       FROM event_invites ei
       JOIN events e ON e.id = ei.event_id
       WHERE ei.id = ? AND ei.status = 'pending'`,
    )
    .get(inviteId) as
    | {
        id: string;
        event_id: string;
        email: string;
        role: string;
        token: string;
        event_title: string;
      }
    | undefined;

  if (!invite) {
    return {
      success: false,
      error: "That invitation is no longer pending.",
    };
  }

  const actorRole = await getEventRole(invite.event_id, actorId);
  if (actorRole === null || !rolePermissions(actorRole).canManageTeam) {
    return {
      success: false,
      error: "Only the event owner and admins can resend invitations.",
    };
  }

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 14,
  ).toISOString();

  db.prepare("UPDATE event_invites SET expires_at = ? WHERE id = ?").run(
    expiresAt,
    inviteId,
  );

  return {
    success: true,
    eventId: invite.event_id,
    email: invite.email,
    role: normalizeRole(invite.role),
    eventTitle: invite.event_title,
    invitePath: `/invite/${invite.token}`,
  };
}

export async function removeEventMember({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const db = await getDb();
  const member = await db
    .prepare(
      `SELECT em.status FROM event_members em WHERE em.event_id = ? AND em.user_id = ?`,
    )
    .get(eventId, userId) as { status: string } | undefined;

  if (!member) {
    return { success: false, error: "Member not found." };
  }

  db.prepare(`DELETE FROM event_members WHERE event_id = ? AND user_id = ?`).run(
    eventId,
    userId,
  );

  return { success: true };
}

/** Lets a member remove themselves; owners keep their event. */
export async function leaveEvent({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const db = await getDb();
  const event = await db
    .prepare(`SELECT owner_id FROM events WHERE id = ?`)
    .get(eventId) as { owner_id: string } | undefined;

  if (!event) {
    return { success: false, error: "This event no longer exists." };
  }

  if (event.owner_id === userId) {
    return { success: false, error: "Owners cannot leave their own event." };
  }

  const removed = await db
    .prepare(`DELETE FROM event_members WHERE event_id = ? AND user_id = ?`)
    .run(eventId, userId);

  if (removed.changes === 0) {
    return { success: false, error: "You are not a member of this event." };
  }

  return { success: true };
}

/** Changes a member's role. Only the event owner can do this. */
export async function updateEventMemberRole({
  eventId,
  memberId,
  role,
  actorId,
}: {
  eventId: string;
  memberId: string;
  role: string;
  actorId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isAssignableRole(role)) {
    return { success: false, error: "That role does not exist." };
  }

  const actorRole = await getEventRole(eventId, actorId);
  if (actorRole !== "owner") {
    return { success: false, error: "Only the event owner can change roles." };
  }

  if (memberId === actorId) {
    return { success: false, error: "You cannot change your own role." };
  }

  const db = await getDb();
  const event = await db
    .prepare(`SELECT owner_id FROM events WHERE id = ?`)
    .get(eventId) as { owner_id: string } | undefined;

  if (!event) {
    return { success: false, error: "This event no longer exists." };
  }

  if (event.owner_id === memberId) {
    return { success: false, error: "The owner's role cannot be changed." };
  }

  const updated = await db
    .prepare(
      `UPDATE event_members
       SET role = ?
       WHERE event_id = ? AND user_id = ? AND status = 'accepted'`,
    )
    .run(role, eventId, memberId);

  if (updated.changes === 0) {
    return { success: false, error: "This person is not a member of the event." };
  }

  return { success: true };
}
