import { NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync";
import { deleteObject, putObject } from "@/lib/storage";
import { findUserById, updateUserAvatarUrl, updateUserName } from "@/lib/users";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

async function getProfile(userId: string) {
  const user = await findUserById(userId);
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, googleAvatarUrl: user.googleAvatarUrl ?? null, workspaceRole: user.workspaceRole };
}

async function removeStoredAvatars(userId: string) {
  await Promise.all(Object.values(CONTENT_TYPES).map((extension) => deleteObject(`avatars/${userId}${extension}`)));
}

export async function GET(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  const profile = await getProfile(device.userId);
  return profile ? NextResponse.json({ profile }) : NextResponse.json({ error: "Account not found." }, { status: 404 });
}

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";
  const user = await findUserById(device.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (action === "get") return NextResponse.json({ profile: await getProfile(user.id) });

  if (action === "update-name") {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Display name must be between 2 and 80 characters." }, { status: 400 });
    await updateUserName(user.id, name);
  } else if (action === "upload-avatar") {
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const extension = CONTENT_TYPES[mimeType];
    const encoded = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
    if (!extension || encoded.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 400 });
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return NextResponse.json({ error: "Choose an image under 2 MB." }, { status: 400 });
    await removeStoredAvatars(user.id);
    await putObject({ key: `avatars/${user.id}${extension}`, bytes, contentType: mimeType });
    await updateUserAvatarUrl(user.id, `/api/avatars/${user.id}${extension}?v=${Date.now()}`);
  } else if (action === "google-avatar") {
    if (!user.googleAvatarUrl) return NextResponse.json({ error: "No Google profile photo is available." }, { status: 400 });
    await removeStoredAvatars(user.id);
    await updateUserAvatarUrl(user.id, user.googleAvatarUrl);
  } else if (action === "remove-avatar") {
    await removeStoredAvatars(user.id);
    await updateUserAvatarUrl(user.id, null);
  } else {
    return NextResponse.json({ error: "Choose a valid profile action." }, { status: 400 });
  }

  return NextResponse.json({ profile: await getProfile(user.id) });
}
