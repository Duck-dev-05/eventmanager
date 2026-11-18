import { NextResponse } from "next/server";
import {
  acknowledgeSyncCursor,
  authenticateSyncRequest,
  pullSyncChanges,
} from "@/lib/sync";

/**
 * Desktop apps poll this endpoint every few seconds. Authenticated with a
 * per-device bearer token created on the Settings page.
 */
export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json(
      { error: "Invalid sync token. Re-pair the desktop app." },
      { status: 401 },
    );
  }

  let cursor = 0;
  try {
    const body = (await request.json()) as { cursor?: unknown };
    const parsed = Number(body?.cursor);
    cursor = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    cursor = 0;
  }

  const result = await pullSyncChanges(device, cursor);

  await acknowledgeSyncCursor(device.id, result.cursor);

  return NextResponse.json(result);
}
