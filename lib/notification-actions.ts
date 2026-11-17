"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notifications.ts";
import { getSessionUser } from "./session-cookie.ts";

export type NotificationState =
  | { error?: string; success?: string }
  | undefined;

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function markNotificationRead(
  _state: NotificationState,
  formData: FormData,
): Promise<NotificationState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const notificationId = text(formData.get("notificationId"));
  if (!notificationId) return { error: "Missing notification." };

  await markNotificationAsRead({ notificationId, userId: user.id });
  await revalidatePath("/notifications");
  return { success: "Marked as read." };
}

export async function markAllNotificationsRead(
  _state: NotificationState,
): Promise<NotificationState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  await markAllNotificationsAsRead(user.id);
  await revalidatePath("/notifications");
  return { success: "All notifications read." };
}
