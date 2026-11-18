"use server";

import {
  createSyncDevice,
  deleteSyncDevice,
} from "./sync.ts";
import { getSessionUser } from "./session-cookie.ts";

export type SyncSettingsState =
  | { error?: string; token?: string; deviceName?: string }
  | undefined;

/** Creates a pairing token for a desktop app. Shown exactly once. */
export async function generateSyncTokenAction(
  _state: SyncSettingsState,
  formData: FormData,
): Promise<SyncSettingsState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const name = String(formData.get("name") ?? "").trim() || "Desktop app";

  const device = await createSyncDevice(user.id, name);

  return {
    token: device.token,
    deviceName: device.name,
  };
}

export async function revokeSyncDeviceAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;

  const deviceId = String(formData.get("deviceId") ?? "");
  if (deviceId) await deleteSyncDevice(user.id, deviceId);
}
