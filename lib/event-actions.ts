"use server";

import { redirect } from "next/navigation";
import { logEventActivity } from "./activity.ts";
import { eventCategories, type EventFormState } from "./event-types.ts";
import { createEvent } from "./events.ts";
import { getSessionUser } from "./session-cookie.ts";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function publishEvent(
  _state: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const values = {
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    category: text(formData.get("category")),
    venue: text(formData.get("venue")),
    date: text(formData.get("date")),
    time: text(formData.get("time")),
    capacity: text(formData.get("capacity")),
  };

  if (values.title.length < 3) {
    return { error: "Give your event a title of at least 3 characters.", values };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    return { error: "Choose the date your event takes place.", values };
  }

  if (!/^\d{2}:\d{2}$/.test(values.time)) {
    return { error: "Choose a start time for your event.", values };
  }

  const startsAt = new Date(`${values.date}T${values.time}`);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "That date and time could not be read. Try again.", values };
  }

  let capacity: number | null = null;
  if (values.capacity) {
    const parsed = Number(values.capacity);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return {
        error: "Capacity must be a whole number of guests above 0.",
        values,
      };
    }
    capacity = parsed;
  }

  const category = eventCategories.includes(values.category)
    ? values.category
    : "Other";

  const event = await createEvent({
    ownerId: user.id,
    title: values.title,
    description: values.description,
    category,
    venue: values.venue,
    startsAt: startsAt.toISOString(),
    capacity,
  });

  await logEventActivity({
    eventId: event.id,
    actorId: user.id,
    kind: "event",
    summary: `${user.name} created the event with the title "${values.title}"`,
  });

  redirect(`/events/${event.id}`);
}

export async function updateEventAction(
  eventId: string,
  _state: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const values = {
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    category: text(formData.get("category")),
    venue: text(formData.get("venue")),
    date: text(formData.get("date")),
    time: text(formData.get("time")),
    capacity: text(formData.get("capacity")),
    visibility: text(formData.get("visibility")),
  };

  if (values.title.length < 3) {
    return { error: "Give your event a title of at least 3 characters.", values };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    return { error: "Choose the date your event takes place.", values };
  }

  if (!/^\d{2}:\d{2}$/.test(values.time)) {
    return { error: "Choose a start time for your event.", values };
  }

  const startsAt = new Date(`${values.date}T${values.time}`);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "That date and time could not be read. Try again.", values };
  }

  let capacity: number | null = null;
  if (values.capacity) {
    const parsed = Number(values.capacity);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return {
        error: "Capacity must be a whole number of guests above 0.",
        values,
      };
    }
    capacity = parsed;
  }

  const category = eventCategories.includes(values.category)
    ? values.category
    : "Other";

  const { updateEvent } = await import("./events");
  const result = await updateEvent({
    eventId,
    actorId: user.id,
    title: values.title,
    description: values.description,
    category,
    venue: values.venue,
    startsAt: startsAt.toISOString(),
    capacity,
    visibility: values.visibility,
  });

  if (!result.success) {
    return { error: result.error ?? "Failed to update event.", values };
  }

  await logEventActivity({
    eventId,
    actorId: user.id,
    kind: "event",
    summary: `updated the event details`,
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/events/${eventId}`, "layout");

  const returnTo = text(formData.get("returnTo")) || `/events/${eventId}`;
  redirect(returnTo);
}

export async function deleteEventAction(formData: FormData) {
  const eventId = text(formData.get("eventId"));
  if (!eventId) redirect("/my-events");

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { deleteEvent } = await import("./events");
  const result = await deleteEvent({
    eventId,
    actorId: user.id,
  });

  if (!result.success) {
    redirect(`/events/${eventId}/edit?error=${encodeURIComponent(result.error ?? "Could not delete")}`);
  }

  redirect("/my-events");
}
