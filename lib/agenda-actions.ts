"use server";

import { revalidatePath } from "next/cache";
import {
  createAgendaItem,
  deleteAgendaItem,
  setAgendaItemStatus,
  updateAgendaItem,
  type AgendaItemStatus,
} from "./agenda";
import { findEventForUser } from "./events";
import { getSessionUser } from "./session-cookie";

export type AgendaActionState =
  | { error?: string; success?: string; itemId?: string }
  | undefined;

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createAgendaItemAction(
  _state: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in to add agenda items." };

  const eventId = text(formData.get("eventId"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  const time = text(formData.get("time"));
  const date = text(formData.get("date"));
  const durationRaw = text(formData.get("durationMinutes"));
  const location = text(formData.get("location"));
  const speakerName = text(formData.get("speakerName"));

  if (!eventId) return { error: "Missing event identifier." };
  if (!title) return { error: "Please enter a session title." };

  const event = await findEventForUser(eventId, user.id);
  if (!event) return { error: "Event not found or access denied." };

  // Calculate startsAt
  let startsAtISO: string;
  const eventStartDate = event.startsAt.split("T")[0] || new Date().toISOString().split("T")[0];
  const targetDate = date || eventStartDate;

  if (time) {
    const combined = new Date(`${targetDate}T${time}:00`);
    if (Number.isNaN(combined.getTime())) {
      return { error: "Invalid session time specified." };
    }
    startsAtISO = combined.toISOString();
  } else {
    startsAtISO = event.startsAt;
  }

  const durationMinutes = Number(durationRaw) || 30;

  const result = await createAgendaItem({
    eventId,
    actorId: user.id,
    title,
    description,
    startsAt: startsAtISO,
    durationMinutes,
    location,
    speakerName,
  });

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/print`);
  revalidatePath(`/events/${eventId}`);

  return { success: `“${title}” added to schedule.` };
}

export async function updateAgendaItemAction(
  _state: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const eventId = text(formData.get("eventId"));
  const itemId = text(formData.get("itemId"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  const time = text(formData.get("time"));
  const date = text(formData.get("date"));
  const durationRaw = text(formData.get("durationMinutes"));
  const location = text(formData.get("location"));
  const speakerName = text(formData.get("speakerName"));
  const statusRaw = text(formData.get("status")) as AgendaItemStatus;

  if (!eventId || !itemId) return { error: "Missing required item references." };
  if (!title) return { error: "Title cannot be empty." };

  const event = await findEventForUser(eventId, user.id);
  if (!event) return { error: "Event not found or access denied." };

  let startsAtISO: string | undefined = undefined;
  if (time) {
    const eventStartDate = event.startsAt.split("T")[0] || new Date().toISOString().split("T")[0];
    const targetDate = date || eventStartDate;
    const combined = new Date(`${targetDate}T${time}:00`);
    if (!Number.isNaN(combined.getTime())) {
      startsAtISO = combined.toISOString();
    }
  }

  const durationMinutes = durationRaw ? Number(durationRaw) : undefined;

  const result = await updateAgendaItem({
    eventId,
    itemId,
    actorId: user.id,
    title,
    description,
    startsAt: startsAtISO,
    durationMinutes,
    location,
    speakerName,
    status: statusRaw || undefined,
  });

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/print`);

  return { success: `“${title}” updated.`, itemId };
}

export async function deleteAgendaItemAction(
  eventId: string,
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await deleteAgendaItem({
    eventId,
    itemId,
    actorId: user.id,
  });

  if (!result.success) return result;

  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/print`);
  return { success: true };
}

export async function setAgendaItemStatusAction(
  eventId: string,
  itemId: string,
  status: AgendaItemStatus,
): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await setAgendaItemStatus({
    eventId,
    itemId,
    actorId: user.id,
    status,
  });

  if (!result.success) return result;

  revalidatePath(`/events/${eventId}/schedule`);
  revalidatePath(`/events/${eventId}/print`);
  return { success: true };
}
