import { NextResponse } from "next/server";
import { findFeedOwner } from "@/lib/calendar-feed";
import { listEventsForUser } from "@/lib/events";
import { buildCalendar } from "@/lib/ics";

/**
 * Calendar subscriptions cannot send cookies, so the unguessable token in the
 * path is the credential. Only the subscriber's own events are returned.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const owner = await findFeedOwner(token);
  if (!owner) {
    return new NextResponse("Calendar not found", { status: 404 });
  }

  const events = await listEventsForUser(owner.id);
  const calendar = buildCalendar({
    calendarName: `${owner.name}'s EventPulse events`,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      venue: event.venue,
      startsAt: event.startsAt,
    })),
  });

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="eventpulse.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
