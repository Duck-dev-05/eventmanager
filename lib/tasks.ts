import { randomUUID } from "node:crypto";
import { getDb } from "./db.ts";
import { getEventRole } from "./events.ts";
import { rolePermissions } from "./roles.ts";
import { logEventActivity } from "./activity.ts";

export type TaskStatus = "open" | "done";

export type EventTask = {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatarUrl?: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskRow = {
  id: string;
  title: string;
  notes: string;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar_url: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

function toTask(row: TaskRow): EventTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status === "done" ? "done" : "open",
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    assigneeAvatarUrl: row.assignee_avatar_url,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type TaskSummary = {
  open: number;
  done: number;
  dueThisWeek: number;
  assigned: number;
};

/** Counts used by the tasks tab. Kept out of components so render stays pure. */
export function summarizeTasks(tasks: EventTask[]): TaskSummary {
  const openTasks = tasks.filter((task) => task.status === "open");
  const weekFromNow = Date.now() + 1000 * 60 * 60 * 24 * 7;

  const dueThisWeek = openTasks.filter(
    (task) => task.dueAt !== null && new Date(task.dueAt).getTime() <= weekFromNow,
  ).length;

  return {
    open: openTasks.length,
    done: tasks.length - openTasks.length,
    dueThisWeek,
    assigned: new Set(openTasks.map((task) => task.assigneeId).filter(Boolean))
      .size,
  };
}

export async function getEventTasks(eventId: string): Promise<EventTask[]> {
  const rows = await (await getDb())
    .prepare(
      `SELECT t.id, t.title, t.notes, t.status, t.assignee_id,
              u.name AS assignee_name, u.avatar_url AS assignee_avatar_url,
              t.due_at, t.created_at, t.updated_at
       FROM event_tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.event_id = ?
       ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
                t.created_at ASC`,
    )
    .all(eventId) as TaskRow[];

  return rows.map(toTask);
}

async function taskPermissions(eventId: string, userId: string) {
  const role = await getEventRole(eventId, userId);
  return role === null ? null : rolePermissions(role);
}

/** Owners and accepted members are the only people work can be assigned to. */
async function hasEventAccess(eventId: string, userId: string) {
  const row = await (await getDb())
    .prepare(
      `SELECT 1
       FROM events e
       WHERE e.id = ?
         AND (
           e.owner_id = ?
           OR EXISTS (
             SELECT 1 FROM event_members em
             WHERE em.event_id = e.id
               AND em.user_id = ?
               AND em.status = 'accepted'
           )
         )`,
    )
    .get(eventId, userId, userId);

  return Boolean(row);
}

/** Owners and admins create tasks for people who already have event access. */
export async function createEventTask({
  eventId,
  actorId,
  title,
  notes,
  assigneeId,
  dueAt,
}: {
  eventId: string;
  actorId: string;
  title: string;
  notes: string;
  assigneeId: string | null;
  dueAt: string | null;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const permissions = await taskPermissions(eventId, actorId);
  if (!permissions?.canEdit) {
    return { success: false, error: "You cannot add tasks to this event." };
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { success: false, error: "Give the task a title." };
  }
  if (cleanTitle.length > 140) {
    return { success: false, error: "Keep the title under 140 characters." };
  }

  const db = await getDb();

  if (assigneeId && !(await hasEventAccess(eventId, assigneeId))) {
    return {
      success: false,
      error: "That person does not have access to this event.",
    };
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO event_tasks
       (id, event_id, title, notes, status, assignee_id, due_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
  ).run(
    id,
    eventId,
    cleanTitle,
    notes.trim(),
    assigneeId,
    dueAt,
    actorId,
    now,
    now,
  );
  await logEventActivity({ eventId, actorId, kind: "task", summary: `created task ${cleanTitle}` });

  return { success: true, id };
}

/** Every role except viewer can change a task's title, owner and deadline. */
export async function updateEventTask({
  eventId,
  taskId,
  actorId,
  title,
  notes,
  assigneeId,
  dueAt,
}: {
  eventId: string;
  taskId: string;
  actorId: string;
  title: string;
  notes: string;
  assigneeId: string | null;
  dueAt: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const permissions = await taskPermissions(eventId, actorId);
  if (!permissions?.canEdit) {
    return { success: false, error: "You cannot edit tasks on this event." };
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { success: false, error: "Give the task a title." };
  }
  if (cleanTitle.length > 140) {
    return { success: false, error: "Keep the title under 140 characters." };
  }

  if (assigneeId && !(await hasEventAccess(eventId, assigneeId))) {
    return {
      success: false,
      error: "That person does not have access to this event.",
    };
  }

  const db = await getDb();
  const existing = await db.prepare("SELECT title,notes,assignee_id,due_at FROM event_tasks WHERE id=? AND event_id=?").get(taskId,eventId) as { title:string; notes:string; assignee_id:string|null; due_at:string|null } | undefined;
  const updated = await db
    .prepare(
      `UPDATE event_tasks
       SET title = ?, notes = ?, assignee_id = ?, due_at = ?, updated_at = ?
       WHERE id = ? AND event_id = ?`,
    )
    .run(cleanTitle, notes.trim(), assigneeId, dueAt, new Date().toISOString(), taskId, eventId);

  if (updated.changes === 0) {
    return { success: false, error: "This task no longer exists." };
  }
  if (existing && (existing.title !== cleanTitle || existing.notes !== notes.trim() || existing.assignee_id !== assigneeId || existing.due_at !== dueAt)) {
    await logEventActivity({ eventId, actorId, kind: "task", summary: `updated task ${cleanTitle}` });
  }

  return { success: true };
}

/** Only the owner and admins may delete a task. */
export async function deleteEventTask({
  eventId,
  taskId,
  actorId,
}: {
  eventId: string;
  taskId: string;
  actorId: string;
}): Promise<
  | { success: true; title: string }
  | { success: false; error: string }
> {
  const permissions = await taskPermissions(eventId, actorId);
  if (!permissions?.canDelete) {
    return { success: false, error: "You cannot delete tasks on this event." };
  }

  const existing = await (await getDb())
    .prepare(`SELECT title FROM event_tasks WHERE id = ? AND event_id = ?`)
    .get(taskId, eventId) as { title: string } | undefined;

  if (!existing) {
    return { success: false, error: "This task no longer exists." };
  }

  const db = await getDb();
  const deleted = await db
    .prepare(`DELETE FROM event_tasks WHERE id = ? AND event_id = ?`)
    .run(taskId, eventId);

  if (deleted.changes === 0) {
    return { success: false, error: "This task no longer exists." };
  }

  await db.prepare(
    `INSERT INTO sync_work_tombstones (event_id,kind,entity_id,deleted_at)
     VALUES (?, 'task', ?, ?) ON CONFLICT(event_id,kind,entity_id)
     DO UPDATE SET deleted_at=excluded.deleted_at`,
  ).run(eventId, taskId, new Date().toISOString());
  await logEventActivity({ eventId, actorId, kind: "task", summary: `deleted task ${existing.title}` });

  return { success: true, title: existing.title };
}

export async function setEventTaskStatus({
  eventId,
  taskId,
  actorId,
  status,
}: {
  eventId: string;
  taskId: string;
  actorId: string;
  status: TaskStatus;
}): Promise<
  | { success: true; title: string }
  | { success: false; error: string }
> {
  const permissions = await taskPermissions(eventId, actorId);
  if (!permissions?.canEdit) {
    return { success: false, error: "You cannot change tasks on this event." };
  }

  const existing = await (await getDb())
    .prepare(`SELECT title, status FROM event_tasks WHERE id = ? AND event_id = ?`)
    .get(taskId, eventId) as { title: string; status: string } | undefined;

  if (!existing) {
    return { success: false, error: "This task no longer exists." };
  }

  const updated = await (await getDb())
    .prepare(
      `UPDATE event_tasks SET status = ?, updated_at = ? WHERE id = ? AND event_id = ?`,
    )
    .run(status === "done" ? "done" : "open", new Date().toISOString(), taskId, eventId);

  if (updated.changes === 0) {
    return { success: false, error: "This task no longer exists." };
  }
  if (existing.status !== (status === "done" ? "done" : "open")) {
    await logEventActivity({ eventId, actorId, kind: "task", summary: `${existing.title} marked ${status === "done" ? "done" : "open"}` });
  }

  return { success: true, title: existing.title };
}
