import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { getEventRole } from "./events.ts";
import { rolePermissions } from "./roles.ts";
import { logEventActivity } from "./activity.ts";

export type AgendaItemStatus = "scheduled" | "live" | "completed" | "cancelled";

export type AgendaItem = {
  id: string;
  eventId: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  location: string;
  speakerName: string;
  status: AgendaItemStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type AgendaRow = {
  id: string;
  event_id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_minutes: number;
  location: string;
  speaker_name: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function toAgendaItem(row: AgendaRow): AgendaItem {
  const validStatus: AgendaItemStatus =
    row.status === "live" || row.status === "completed" || row.status === "cancelled"
      ? row.status
      : "scheduled";

  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    durationMinutes: Number(row.duration_minutes) || 30,
    location: row.location,
    speakerName: row.speaker_name,
    status: validStatus,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEventAgenda(eventId: string): Promise<AgendaItem[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `
      SELECT id, event_id, title, description, starts_at, duration_minutes,
             location, speaker_name, status, sort_order, created_at, updated_at
      FROM event_agenda_items
      WHERE event_id = ?
      ORDER BY datetime(starts_at) ASC, sort_order ASC, created_at ASC
    `,
    )
    .all(eventId) as AgendaRow[];

  return rows.map(toAgendaItem);
}

export async function getAgendaItemById(itemId: string): Promise<AgendaItem | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `
      SELECT id, event_id, title, description, starts_at, duration_minutes,
             location, speaker_name, status, sort_order, created_at, updated_at
      FROM event_agenda_items
      WHERE id = ?
    `,
    )
    .get(itemId) as AgendaRow | undefined;

  return row ? toAgendaItem(row) : null;
}

export type AgendaSummary = {
  total: number;
  scheduled: number;
  live: number;
  completed: number;
  totalDurationMinutes: number;
};

export function summarizeAgenda(items: AgendaItem[]): AgendaSummary {
  let scheduled = 0;
  let live = 0;
  let completed = 0;
  let totalDurationMinutes = 0;

  for (const item of items) {
    if (item.status === "live") live++;
    else if (item.status === "completed") completed++;
    else if (item.status === "scheduled") scheduled++;

    if (item.status !== "cancelled") {
      totalDurationMinutes += item.durationMinutes;
    }
  }

  return {
    total: items.length,
    scheduled,
    live,
    completed,
    totalDurationMinutes,
  };
}

export async function createAgendaItem({
  eventId,
  actorId,
  title,
  description = "",
  startsAt,
  durationMinutes = 30,
  location = "",
  speakerName = "",
  sortOrder = 0,
}: {
  eventId: string;
  actorId: string;
  title: string;
  description?: string;
  startsAt: string;
  durationMinutes?: number;
  location?: string;
  speakerName?: string;
  sortOrder?: number;
}): Promise<{ success: true; item: AgendaItem } | { success: false; error: string }> {
  const role = await getEventRole(eventId, actorId);
  if (!role) {
    return { success: false, error: "You don't have access to this event." };
  }

  const { canEdit } = rolePermissions(role);
  if (!canEdit) {
    return { success: false, error: "You don't have permission to add agenda sessions." };
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { success: false, error: "Please enter a session title." };
  }

  const parsedDate = new Date(startsAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, error: "Please enter a valid start time." };
  }

  const cleanDuration = Math.max(5, Math.min(1440, Math.floor(Number(durationMinutes) || 30)));
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const db = await getDb();
  db.prepare(
    `
    INSERT INTO event_agenda_items (
      id, event_id, title, description, starts_at, duration_minutes,
      location, speaker_name, status, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
  `,
  ).run(
    id,
    eventId,
    trimmedTitle,
    description.trim(),
    parsedDate.toISOString(),
    cleanDuration,
    location.trim(),
    speakerName.trim(),
    sortOrder,
    createdAt,
    createdAt,
  );
  await logEventActivity({ eventId, actorId, kind: "agenda", summary: `created agenda session ${trimmedTitle}` });

  return {
    success: true,
    item: {
      id,
      eventId,
      title: trimmedTitle,
      description: description.trim(),
      startsAt: parsedDate.toISOString(),
      durationMinutes: cleanDuration,
      location: location.trim(),
      speakerName: speakerName.trim(),
      status: "scheduled",
      sortOrder,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

export async function updateAgendaItem({
  eventId,
  itemId,
  actorId,
  title,
  description,
  startsAt,
  durationMinutes,
  location,
  speakerName,
  status,
  sortOrder,
}: {
  eventId: string;
  itemId: string;
  actorId: string;
  title?: string;
  description?: string;
  startsAt?: string;
  durationMinutes?: number;
  location?: string;
  speakerName?: string;
  status?: AgendaItemStatus;
  sortOrder?: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  const role = await getEventRole(eventId, actorId);
  if (!role) {
    return { success: false, error: "You don't have access to this event." };
  }

  const { canEdit } = rolePermissions(role);
  if (!canEdit) {
    return { success: false, error: "You don't have permission to modify agenda items." };
  }

  const existing = await getAgendaItemById(itemId);
  if (!existing || existing.eventId !== eventId) {
    return { success: false, error: "Agenda item not found." };
  }

  const nextTitle = title !== undefined ? title.trim() : existing.title;
  if (!nextTitle) {
    return { success: false, error: "Session title cannot be empty." };
  }

  let nextStartsAt = existing.startsAt;
  if (startsAt) {
    const parsed = new Date(startsAt);
    if (Number.isNaN(parsed.getTime())) {
      return { success: false, error: "Invalid start time provided." };
    }
    nextStartsAt = parsed.toISOString();
  }

  const nextDuration =
    durationMinutes !== undefined
      ? Math.max(5, Math.min(1440, Math.floor(Number(durationMinutes) || 30)))
      : existing.durationMinutes;

  const nextDescription = description !== undefined ? description.trim() : existing.description;
  const nextLocation = location !== undefined ? location.trim() : existing.location;
  const nextSpeaker = speakerName !== undefined ? speakerName.trim() : existing.speakerName;
  const nextStatus = status !== undefined ? status : existing.status;
  const nextSortOrder = sortOrder !== undefined ? sortOrder : existing.sortOrder;

  const db = await getDb();
  const changed = existing.title !== nextTitle || existing.description !== nextDescription || existing.startsAt !== nextStartsAt || existing.durationMinutes !== nextDuration || existing.location !== nextLocation || existing.speakerName !== nextSpeaker || existing.status !== nextStatus || existing.sortOrder !== nextSortOrder;
  db.prepare(
    `
    UPDATE event_agenda_items
    SET title = ?, description = ?, starts_at = ?, duration_minutes = ?,
        location = ?, speaker_name = ?, status = ?, sort_order = ?, updated_at = ?
    WHERE id = ? AND event_id = ?
  `,
  ).run(
    nextTitle,
    nextDescription,
    nextStartsAt,
    nextDuration,
    nextLocation,
    nextSpeaker,
    nextStatus,
    nextSortOrder,
    new Date().toISOString(),
    itemId,
    eventId,
  );
  if (changed) await logEventActivity({ eventId, actorId, kind: "agenda", summary: `updated agenda session ${nextTitle}` });

  return { success: true };
}

export async function deleteAgendaItem({
  eventId,
  itemId,
  actorId,
}: {
  eventId: string;
  itemId: string;
  actorId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const role = await getEventRole(eventId, actorId);
  if (!role) {
    return { success: false, error: "You don't have access to this event." };
  }

  const { canDelete, canEdit } = rolePermissions(role);
  if (!canDelete && !canEdit) {
    return { success: false, error: "You don't have permission to delete agenda items." };
  }

  const db = await getDb();
  const existing = await db
    .prepare("SELECT title FROM event_agenda_items WHERE id = ? AND event_id = ?")
    .get(itemId, eventId) as { title: string } | undefined;
  const res = await db
    .prepare("DELETE FROM event_agenda_items WHERE id = ? AND event_id = ?")
    .run(itemId, eventId);

  if (res.changes === 0) {
    return { success: false, error: "Item not found or already deleted." };
  }

  await db.prepare(
    `INSERT INTO sync_work_tombstones (event_id,kind,entity_id,deleted_at)
     VALUES (?, 'agenda', ?, ?) ON CONFLICT(event_id,kind,entity_id)
     DO UPDATE SET deleted_at=excluded.deleted_at`,
  ).run(eventId, itemId, new Date().toISOString());
  if (existing) {
    await logEventActivity({ eventId, actorId, kind: "agenda", summary: `deleted agenda session ${existing.title}` });
  }

  return { success: true };
}

export async function setAgendaItemStatus({
  eventId,
  itemId,
  actorId,
  status,
}: {
  eventId: string;
  itemId: string;
  actorId: string;
  status: AgendaItemStatus;
}): Promise<{ success: true } | { success: false; error: string }> {
  const role = await getEventRole(eventId, actorId);
  if (!role) {
    return { success: false, error: "You don't have access to this event." };
  }

  const { canEdit } = rolePermissions(role);
  if (!canEdit) {
    return { success: false, error: "You don't have permission to update item status." };
  }

  const db = await getDb();
  const existing = await db.prepare("SELECT title,status FROM event_agenda_items WHERE id=? AND event_id=?").get(itemId,eventId) as { title:string; status:string } | undefined;
  const res = await db
    .prepare("UPDATE event_agenda_items SET status = ?, updated_at = ? WHERE id = ? AND event_id = ?")
    .run(status, new Date().toISOString(), itemId, eventId);

  if (res.changes === 0) {
    return { success: false, error: "Item not found." };
  }
  if (existing && existing.status !== status) {
    await logEventActivity({ eventId, actorId, kind: "agenda", summary: `agenda session ${existing.title} marked ${status}` });
  }

  return { success: true };
}
