import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-cookie";
import { eventStatus, findEventForUser, getEventRole } from "@/lib/events";
import { rolePermissions } from "@/lib/roles";
import { dayNumber, monthShort, startTime } from "@/lib/event-format";
import {
  ClockIcon,
  DownloadIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
} from "./icons";
import { ShareMenu } from "./share-menu";


const statusStyles = {
  Upcoming: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  Past: "bg-zinc-100 text-zinc-500 ring-zinc-200",
} as const;

export async function EventHeader({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const role = await getEventRole(id, user.id);
  const isHost = role === "owner";
  const canInvite = role !== null && rolePermissions(role).canManageTeam;

  const startsAt = new Date(event.startsAt);
  const status = eventStatus(event.startsAt);

  const now = new Date();
  const msUntil = startsAt.getTime() - now.getTime();
  const daysUntil = Math.ceil(msUntil / 86_400_000);
  const isSoon = daysUntil > 0 && daysUntil <= 7;

  return (
    <section className="relative rounded-2xl border border-[#e8e6de] bg-white px-5 py-5 shadow-sm shadow-zinc-900/[0.025] sm:px-7 print:hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div className="absolute -right-12 -top-20 h-44 w-44 rounded-full bg-gradient-to-br from-orange-100/70 to-emerald-50/50 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center rounded-2xl bg-[#193b30] text-white shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-orange-200">
            {monthShort.format(startsAt)}
          </span>
          <span className="text-[23px] font-semibold leading-none">
            {dayNumber.format(startsAt)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${statusStyles[status]}`}
            >
              {status}
            </span>
            <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {event.category}
            </span>
            <span
              title={
                event.visibility === "public"
                  ? "Anyone in this workspace with the link can view this event"
                  : "Only invited members can open this event"
              }
              className={
                event.visibility === "public"
                  ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100"
                  : "inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200"
              }
            >
              {event.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>

          <h1 className="mt-1.5 text-[23px] font-semibold leading-tight tracking-tight text-[#18231d]">
            {event.title}
          </h1>

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
              {startTime.format(startsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="truncate">
                {event.venue || "Location to be announced"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 text-zinc-400" />
              {event.capacity
                ? `Up to ${event.capacity} guests`
                : "No capacity limit"}
            </span>
            {status === "Upcoming" && msUntil > 0 && daysUntil <= 60 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-zinc-300" />
                <span
                  className={
                    isSoon
                      ? "font-semibold text-emerald-700"
                      : "text-zinc-600"
                  }
                >
                  {daysUntil === 0
                    ? "Happening today"
                    : daysUntil === 1
                      ? "Tomorrow"
                      : `In ${daysUntil} days`}
                </span>
              </span>
            ) : null}
            {status === "Past" ? (
              <span className="inline-flex items-center gap-1.5 italic text-zinc-400">
                <span className="h-1 w-1 rounded-full bg-zinc-300" />
                Event has passed
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link
            href={`/api/events/${event.id}/ics`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e1d8] bg-white px-3 text-[12.5px] font-semibold text-[#193b30] shadow-sm transition hover:border-[#d5cfc2] hover:bg-[#fcfbf8]"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-zinc-500" />
            Add to calendar
          </Link>
          {isHost ? (
            <Link
              href={`/events/${event.id}/settings`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e1d8] bg-white px-3 text-[12.5px] font-semibold text-[#193b30] shadow-sm transition hover:border-[#d5cfc2] hover:bg-[#fcfbf8]"
            >
              <SettingsIcon className="h-3.5 w-3.5 text-zinc-500" />
              Settings
            </Link>
          ) : null}
          <ShareMenu
            eventTitle={event.title}
            eventId={event.id}
            isOwner={canInvite}
          />
        </div>
      </div>
    </section>
  );
}

export function EventHeaderSkeleton() {
  return (
    <section className="rounded-2xl border border-[#e8e6de] bg-white p-5">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="h-[58px] w-[58px] shrink-0 animate-pulse rounded-2xl bg-zinc-100" />
        <div className="flex-1 space-y-4">
          <div className="h-5 w-24 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
    </section>
  );
}
