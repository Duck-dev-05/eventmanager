import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/avatar";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import { CalendarIcon, ClockIcon, MapPinIcon, TicketIcon } from "@/components/icons";
import {
  eventStatus,
  findEventForUser,
  getEventOwner,
  getEventRole,
} from "@/lib/events";
import { longDate, startTime } from "@/lib/event-format";
import { getSessionUser } from "@/lib/session-cookie";

async function Overview({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [event, owner, role] = await Promise.all([
    findEventForUser(id, user.id),
    getEventOwner(id),
    getEventRole(id, user.id),
  ]);
  if (!event) notFound();

  const organizerName = owner?.name ?? "Event Organizer";
  // Public visitors see the organiser's name but never their email.
  const organizerEmail = role ? (owner?.email ?? "") : "";

  const startsAt = new Date(event.startsAt);
  const status = eventStatus(event.startsAt);

  const facts = [
    { label: "Category", value: event.category || "—" },
    { label: "Venue", value: event.venue || "—" },
    { label: "Capacity", value: event.capacity ? `${event.capacity}` : "Unlimited" },
    { label: "Status", value: status },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <header className="flex items-center gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
                <TicketIcon className="h-[16px] w-[16px]" />
              </span>
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
                About this event
              </h2>
            </header>
            <div className="px-5 py-5">
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-600">
                {event.description || "No description was added for this event."}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <header className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">At a glance</h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">Key facts about this event.</p>
            </header>
            <dl className="grid grid-cols-2 divide-x divide-y divide-[#f0ede5] sm:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="px-5 py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {fact.label}
                  </dt>
                  <dd className="mt-1.5 truncate text-[13px] font-medium text-zinc-800">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <header className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">Organizer</h2>
            </header>
            <div className="flex items-center gap-3 px-5 py-4">
              <Avatar
                src={owner?.avatarUrl}
                initials={organizerName.slice(0, 2).toUpperCase()}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-zinc-900">
                  {organizerName}
                </p>
                {organizerEmail ? (
                  <p className="truncate text-[12px] text-zinc-500">{organizerEmail}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <header className="flex items-center gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
                <CalendarIcon className="h-[16px] w-[16px]" />
              </span>
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
                Schedule
              </h2>
            </header>
            <dl className="space-y-3 px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12.5px] text-zinc-500">Date</dt>
                <dd className="text-right text-[13px] font-medium text-zinc-800">
                  {longDate.format(startsAt)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                  <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
                  Start
                </dt>
                <dd className="text-[13px] font-medium text-zinc-800">
                  {startTime.format(startsAt)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                  <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                  Venue
                </dt>
                <dd className="text-right text-[13px] font-medium text-zinc-800">
                  {event.venue || "Location to be announced"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12.5px] text-zinc-500">Status</dt>
                <dd className="text-[13px] font-medium text-zinc-800">{status}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function EventOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<EventTabSkeleton />}>
      {params.then(({ id }) => (
        <Overview id={id} />
      ))}
    </Suspense>
  );
}