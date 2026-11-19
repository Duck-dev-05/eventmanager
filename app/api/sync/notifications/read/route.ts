import { NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });

  let body: { notificationId?: unknown; markAll?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const now = new Date().toISOString();
  const db = await getDb();
  if (body.markAll === true) {
    await db.prepare("UPDATE event_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(now, device.userId);
  } else if (typeof body.notificationId === "string" && body.notificationId.length <= 128) {
    await db.prepare("UPDATE event_notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL").run(now, body.notificationId, device.userId);
  } else {
    return NextResponse.json({ error: "A notification id or markAll flag is required." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
