import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { DeleteEventSection } from "@/components/delete-event-dialog";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { secondaryButton } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { updateEventAction } from "@/lib/event-actions";
import { canManageEvent, findEventForUser } from "@/lib/events";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

function EditSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-64 animate-pulse rounded-2xl bg-white/70" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[520px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white" />
        <div className="h-[320px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white" />
      </div>
    </div>
  );
}

async function EditContent({ id, error }: { id: string; error?: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const isManager = await canManageEvent(id, user.id);
  if (!isManager) {
    redirect(`/events/${id}`);
  }

  const isOwner = event.ownerId === user.id;

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
  };

  const boundAction = updateEventAction.bind(null, id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Edit event"
        description="Update event schedule, venue, capacity, or details."
        action={
          <Link href={`/events/${id}`} className={secondaryButton}>
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
            Back to event
          </Link>
        }
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <EventForm
        action={boundAction}
        initialValues={initialValues}
        submitLabel="Save changes"
        pendingLabel="Saving changes..."
        cancelHref={`/events/${id}`}
      />

      {isOwner ? (
        <div className="max-w-4xl">
          <DeleteEventSection eventId={id} eventTitle={event.title} />
        </div>
      ) : null}
    </div>
  );
}

export default function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      {Promise.all([
        params,
        searchParams ?? Promise.resolve(undefined),
      ]).then(([{ id }, search]) => (
        <EditContent id={id} error={search?.error} />
      ))}
    </Suspense>
  );
}
