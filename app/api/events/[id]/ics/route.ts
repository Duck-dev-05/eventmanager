import { NextResponse } from "next/server";
import { findEventForUser } from "@/lib/events";
import { calendarFileName, buildCalendar } from "@/lib/ics";
import { getSessionUser } from "@/lib/session-cookie";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to download this event." },
      { status: 401 },
    );
  }

  const event = await findEventForUser(id, user.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const calendar = buildCalendar({
    calendarName: event.title,
    events: [
      {
        id: event.id,
        title: event.title,
        description: event.description,
        venue: event.venue,
        startsAt: event.startsAt,
      },
    ],
  });

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarFileName(event.title)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
