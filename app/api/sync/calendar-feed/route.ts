import { NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync";
import { getOrCreateCalendarToken, rotateCalendarToken } from "@/lib/calendar-feed";

export async function GET(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  const url = new URL(request.url);
  const rotate = url.searchParams.get("rotate") === "1";
  const token = rotate ? await rotateCalendarToken(device.userId) : await getOrCreateCalendarToken(device.userId);
  return NextResponse.json({ feedUrl: `/api/calendar/${token}` });
}
