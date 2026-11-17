import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { EventSettingsView } from "@/components/event-settings-view";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import { updateEventAction } from "@/lib/event-actions";
import { findEventForUser, getEventRole } from "@/lib/events";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

async function EventSettings({
  id,
  saved,
}: {
  id: string;
  saved?: string;
}) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const role = await getEventRole(id, user.id);
  // Strictly enforce: Only the host (owner) can view or change settings
  if (role !== "owner") {
    redirect(`/events/${id}`);
  }

  const startsAt = new Date(event.startsAt);
  const year = startsAt.getFullYear();
  const month = String(startsAt.getMonth() + 1).padStart(2, "0");
  const day = String(startsAt.getDate()).padStart(2, "0");
  const hours = String(startsAt.getHours()).padStart(2, "0");
  const minutes = String(startsAt.getMinutes()).padStart(2, "0");

  const initialValues = {
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    capacity: event.capacity ? String(event.capacity) : "",
    visibility: event.visibility,
  };

  const boundAction = updateEventAction.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/events/${id}/edit`}
          className="text-[12.5px] font-semibold text-[#193b30] underline-offset-2 hover:underline"
        >
          Open the full edit page
        </Link>
      </div>

      <EventSettingsView
        eventId={id}
        action={boundAction}
        initialValues={initialValues}
        createdAt={event.createdAt}
        hostName={user.name}
        hostEmail={user.email}
        isSaved={saved === "true"}
      />
    </div>
  );
}

export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const [{ id }, search] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  return (
    <Suspense fallback={<EventTabSkeleton />}>
      <EventSettings id={id} saved={search?.saved} />
    </Suspense>
  );
}
