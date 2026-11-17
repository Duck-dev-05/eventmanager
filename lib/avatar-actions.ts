"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { dataDirectory } from "./db";
import { getSessionUser } from "./session-cookie";
import { findUserById, updateUserAvatarUrl } from "./users";

export type AvatarState = { error?: string; success?: string } | undefined;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function avatarDirectory() {
  return path.join(dataDirectory(), "avatars");
}

async function removeStoredAvatars(userId: string) {
  await Promise.all(
    Object.values(EXTENSIONS).map((extension) =>
      unlink(path.join(avatarDirectory(), `${userId}${extension}`)).catch(
        () => {},
      ),
    ),
  );
}

export async function uploadAvatar(
  _state: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to change your photo." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return { error: "Use a PNG, JPEG or WebP image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Keep profile photos under 2 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  await mkdir(avatarDirectory(), { recursive: true });
  await removeStoredAvatars(user.id);
  await writeFile(path.join(avatarDirectory(), `${user.id}${extension}`), bytes);
  await updateUserAvatarUrl(
    user.id,
    `/api/avatars/${user.id}${extension}?v=${Date.now()}`,
  );

  revalidatePath("/", "layout");
  return { success: "Profile photo updated." };
}

export async function useGoogleAvatar(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const stored = await findUserById(user.id);
  if (!stored?.googleAvatarUrl) return;

  await removeStoredAvatars(user.id);
  await updateUserAvatarUrl(user.id, stored.googleAvatarUrl);
  revalidatePath("/", "layout");
}

export async function removeAvatar(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await removeStoredAvatars(user.id);
  await updateUserAvatarUrl(user.id, null);
  revalidatePath("/", "layout");
}
