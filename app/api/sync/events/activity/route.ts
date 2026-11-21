import { NextResponse } from "next/server";
import { getEventActivity } from "@/lib/activity";
import { findEventForUser, getEventRole } from "@/lib/events";
import { authenticateSyncRequest } from "@/lib/sync";

export async function GET(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the mobile app." }, { status: 401 });
  }

  const eventId = new URL(request.url).searchParams.get("eventId")?.trim() ?? "";
  if (!eventId) return NextResponse.json({ error: "Choose an event." }, { status: 400 });

  const event = await findEventForUser(eventId, device.userId);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const [entries, role] = await Promise.all([
    getEventActivity(eventId, 60),
    getEventRole(eventId, device.userId),
  ]);

  // Publicly viewable events must not expose internal team or work details.
  const activity = role
    ? entries
    : entries.filter((entry) => entry.kind === "event" || entry.kind === "agenda");

  return NextResponse.json({
    activity: [
      {
        id: "created",
        kind: "event",
        summary: `Event created: ${event.title}`,
        createdAt: event.createdAt,
        actorName: "Event organizer",
      },
      ...activity.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        summary: entry.summary,
        createdAt: entry.createdAt,
        actorName: entry.actorName ?? "A teammate",
      })),
    ],
  });
}
