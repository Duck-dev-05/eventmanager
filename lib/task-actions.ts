"use server";

import { revalidatePath } from "next/cache";
import { logEventActivity } from "./activity";
import { emailTaskAssignment } from "./notification-email";
import { getSessionUser } from "./session-cookie";
import {
  createEventTask,
  deleteEventTask,
  setEventTaskStatus,
  updateEventTask,
} from "./tasks";

export type TaskState =
  | { error?: string; success?: string; title?: string }
  | undefined;

export type TaskActionResult =
  | { success: true }
  | { success: false; error: string };

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Date inputs are calendar days, not instants: pin them to local noon so a
 * task does not drift to the previous day for users east of UTC.
 */
function dueAtFromInput(value: string): { dueAt: string | null } | null {
  if (!value) return { dueAt: null };

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return { dueAt: parsed.toISOString() };
}

export async function createTask(
  _state: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const eventId = text(formData.get("eventId"));
  const title = text(formData.get("title"));
  const notes = text(formData.get("notes"));
  const assigneeId = text(formData.get("assigneeId")) || null;
  const due = dueAtFromInput(text(formData.get("dueDate")));

  if (!eventId) return { error: "Missing event." };
  if (!title) return { error: "Give the task a title." };
  if (!due) return { error: "That due date is not valid." };

  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to add a task." };

  const result = await createEventTask({
    eventId,
    actorId: user.id,
    title,
    notes,
    assigneeId,
    dueAt: due.dueAt,
  });

  if (!result.success) return { error: result.error, title };

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "task",
    summary: `added task "${title}"`,
  });

  if (assigneeId) {
    await emailTaskAssignment({
      eventId,
      assigneeId,
      actorId: user.id,
      actorName: user.name,
      taskTitle: title,
      dueAt: due.dueAt,
    });
  }

  revalidatePath(`/events/${eventId}/tasks`);
  return { success: `"${title}" added to the task list.`, title };
}

export async function updateTask(
  _state: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const eventId = text(formData.get("eventId"));
  const taskId = text(formData.get("taskId"));
  const title = text(formData.get("title"));
  const notes = text(formData.get("notes"));
  const assigneeId = text(formData.get("assigneeId")) || null;
  const due = dueAtFromInput(text(formData.get("dueDate")));

  if (!eventId) return { error: "Missing event." };
  if (!taskId) return { error: "Missing task." };
  if (!title) return { error: "Give the task a title." };
  if (!due) return { error: "That due date is not valid." };

  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const result = await updateEventTask({
    eventId,
    taskId,
    actorId: user.id,
    title,
    notes,
    assigneeId,
    dueAt: due.dueAt,
  });

  if (!result.success) return { error: result.error, title };

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "task",
    summary: `updated task "${title}"`,
  });

  if (assigneeId) {
    await emailTaskAssignment({
      eventId,
      assigneeId,
      actorId: user.id,
      actorName: user.name,
      taskTitle: title,
      dueAt: due.dueAt,
    });
  }

  revalidatePath(`/events/${eventId}/tasks`);
  return { success: "Task updated.", title };
}

export async function deleteTask(
  eventId: string,
  taskId: string,
): Promise<TaskActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await deleteEventTask({ eventId, taskId, actorId: user.id });
  if (!result.success) return result;

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "task",
    summary: `deleted task "${result.title}"`,
  });

  revalidatePath(`/events/${eventId}/tasks`);
  return { success: true };
}

export async function toggleTask(
  eventId: string,
  taskId: string,
  status: string,
): Promise<TaskActionResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await setEventTaskStatus({
    eventId,
    taskId,
    actorId: user.id,
    status: status === "done" ? "done" : "open",
  });
  if (!result.success) return result;

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "task",
    summary:
      status === "done"
        ? `marked "${result.title}" as done`
        : `reopened "${result.title}"`,
  });

  revalidatePath(`/events/${eventId}/tasks`);
  return { success: true };
}
