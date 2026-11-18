import { NextResponse } from "next/server";
import { authenticateSyncRequest, pushSyncChanges } from "@/lib/sync";

/**
 * Receives event mutations created in the desktop app. Authenticated with a
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

  let changes: Parameters<typeof pushSyncChanges>[1] = [];
  try {
    const body = (await request.json()) as { changes?: unknown };
    if (Array.isArray(body?.changes)) changes = body.changes as typeof changes;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await pushSyncChanges(device, changes);

  return NextResponse.json(result);
}
