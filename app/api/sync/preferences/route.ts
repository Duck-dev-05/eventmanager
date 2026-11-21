import { NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync";
import { getPreferences, savePreferences } from "@/lib/preferences";

export async function GET(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }
  return NextResponse.json({ preferences: await getPreferences(device.userId) });
}

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const capacity = body.defaultCapacity;
  if (capacity !== null && capacity !== undefined && (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 100_000)) {
    return NextResponse.json({ error: "Default capacity must be a whole number between 1 and 100,000, or empty for no limit." }, { status: 400 });
  }
  for (const key of ["eventReminders", "emailUpdates", "weeklyDigest"] as const) {
    if (typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `Invalid ${key} preference.` }, { status: 400 });
    }
  }

  const preferences = await savePreferences(device.userId, {
    eventReminders: body.eventReminders as boolean,
    emailUpdates: body.emailUpdates as boolean,
    weeklyDigest: body.weeklyDigest as boolean,
    defaultCapacity: capacity == null ? null : Number(capacity),
  });
  return NextResponse.json({ preferences });
}
