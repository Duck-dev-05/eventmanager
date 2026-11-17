import { Suspense, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import {
  CalendarIcon,
  CheckCircleSolidIcon,
  DownloadIcon,
  UsersIcon,
} from "@/components/icons";
import { getEventActivity } from "@/lib/activity";
import { findEventForUser, getEventOwner, getEventRole } from "@/lib/events";
import { getSessionUser } from "@/lib/session-cookie";
import { timeStamp } from "@/lib/event-format";

const kindStyles: Record<
  string,
  { icon: ReactNode; tone: string; label: string }
> = {
  event: {
    icon: <CalendarIcon className="h-[20px] w-[20px]" />,
    tone: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    label: "Event",
  },
  member: {
    icon: <UsersIcon className="h-[20px] w-[20px]" />,
    tone: "bg-sky-50 text-sky-600 ring-sky-100",
    label: "Team",
  },
  task: {
    icon: <CheckCircleSolidIcon className="h-[20px] w-[20px]" />,
    tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    label: "Tasks",
  },
  file: {
    icon: <DownloadIcon className="h-[20px] w-[20px]" />,
    tone: "bg-amber-50 text-amber-600 ring-amber-100",
    label: "Files",
  },
  agenda: {
    icon: <CalendarIcon className="h-[20px] w-[20px]" />,
    tone: "bg-violet-50 text-violet-600 ring-violet-100",
    label: "Agenda",
  },
};

const fallbackStyle = kindStyles.event;

async function Activity({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const [entries, owner, role] = await Promise.all([
    getEventActivity(id, 60),
    getEventOwner(id),
    getEventRole(id, user.id),
  ]);

  // Public visitors get event-level and agenda activity only: team entries
  // contain email addresses, and task/file entries expose internal work.
  const visibleEntries = role
    ? entries
    : entries.filter(
        (entry) => entry.kind === "event" || entry.kind === "agenda",
      );

  const timeline = [
    ...visibleEntries,
    {
      id: "created",
      kind: "event",
      summary: `${owner?.name ?? "The organiser"} created this event and became its owner.`,
      createdAt: event.createdAt,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
      <header className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
            Activity
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
          A running log of what happens inside this event.
        </p>
      </header>

      <div className="px-6 py-6">
        <ol className="relative space-y-7 border-l-2 border-[#e8e4dc] pl-8">
          {timeline.map((entry) => {
            const style = kindStyles[entry.kind] ?? fallbackStyle;

            return (
              <li key={entry.id} className="relative">
                <span
                  className={`absolute -left-[43px] flex h-9 w-9 items-center justify-center rounded-xl ring-2 ${style.tone}`}
                >
                  {style.icon}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-[#18231d]">
                    {style.label}
                  </p>
                  <span className="text-[12px] tabular-nums text-zinc-400">
                    {timeStamp.format(new Date(entry.createdAt))}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                  {entry.summary}
                </p>
              </li>
            );
          })}
        </ol>

        {visibleEntries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#e5e2d9] bg-[#faf8f2]/50 px-5 py-6 text-center">
            <p className="text-[13px] font-medium text-zinc-600">
              Nothing else yet
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
              {role
                ? "Invitations, role changes, tasks and file uploads will appear here automatically as your team works."
                : "Event and agenda updates will appear here as the organiser makes changes."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function EventActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EventTabSkeleton />}>
      {params.then(({ id }) => (
        <Activity id={id} />
      ))}
    </Suspense>
  );
}
