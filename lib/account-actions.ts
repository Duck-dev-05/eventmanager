"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { savePreferences } from "./preferences";
import { getSessionUser } from "./session-cookie";
import { updateUserName } from "./users";

export type ProfileState =
  | { error?: string; success?: string; name?: string }
  | undefined;

export type PreferencesState =
  | { error?: string; success?: string }
  | undefined;

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(
  _state: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = text(formData.get("name")).replace(/\s+/g, " ");

  if (name.length < 2) {
    return { error: "Enter a name with at least 2 characters.", name };
  }

  if (name.length > 80) {
    return { error: "Keep your name under 80 characters.", name };
  }

  await updateUserName(user.id, name);

  // The name is shown in the topbar and sidebar, so refresh every layout.
  revalidatePath("/", "layout");

  return { success: "Profile updated.", name };
}

export async function updatePreferences(
  _state: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const capacityValue = text(formData.get("defaultCapacity"));
  let defaultCapacity: number | null = null;

  if (capacityValue) {
    const parsed = Number(capacityValue);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) {
      return {
        error:
          "Default capacity must be a whole number between 1 and 100,000, or empty for no limit.",
      };
    }

    defaultCapacity = parsed;
  }

  await savePreferences(user.id, {
    eventReminders: formData.get("eventReminders") === "on",
    emailUpdates: formData.get("emailUpdates") === "on",
    weeklyDigest: formData.get("weeklyDigest") === "on",
    defaultCapacity,
  });

  revalidatePath("/settings");

  return { success: "Preferences saved." };
}
