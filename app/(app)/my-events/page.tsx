import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EventsList, type EventListItem } from "@/components/events-list";
import { PageHeader } from "@/components/page-header";
import { PrimaryLink } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { eventStatus, listEventsForUser } from "@/lib/events";
import { getSessionUser } from "@/lib/session-cookie";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function EventsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-11 w-full animate-pulse rounded-xl bg-white/70 sm:w-[420px]" />
      <div className="space-y-2 rounded-3xl border border-zinc-200/70 bg-white p-4">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-[70px] animate-pulse rounded-xl bg-zinc-100/80"
          />
        ))}
      </div>
    </div>
  );
}

async function Events() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const events = await listEventsForUser(user.id);

  const items: EventListItem[] = events.map((event) => {
    const startsAt = new Date(event.startsAt);

    return {
      id: event.id,
      title: event.title,
      month: monthFormatter.format(startsAt),
      day: dayFormatter.format(startsAt),
      time: timeFormatter.format(startsAt),
      venue: event.venue || "Location to be announced",
      capacity: event.capacity,
      status: eventStatus(event.startsAt),
      isOwner: event.ownerId === user.id,
    };
  });

  return <EventsList events={items} />;
}

export default function MyEventsPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="My Events"
        description="Events you own or collaborate on, in one place."
        action={
          <PrimaryLink href="/events/new">
            <PlusIcon className="h-4 w-4" />
            Create event
          </PrimaryLink>
        }
      />

      <Suspense fallback={<EventsSkeleton />}>
        <Events />
      </Suspense>
    </div>
  );
}
