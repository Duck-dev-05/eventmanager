"use server";

import { revalidatePath } from "next/cache";
import { rotateCalendarToken } from "./calendar-feed.ts";
import { getSessionUser } from "./session-cookie.ts";

export async function rotateCalendarFeed() {
  const user = await getSessionUser();
  if (!user) return;

  await rotateCalendarToken(user.id);
  revalidatePath("/settings");
}
