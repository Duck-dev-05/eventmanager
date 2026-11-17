import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  CalendarIcon,
  CheckCircleSolidIcon,
  ClockIcon,
  ColumnsIcon,
  DownloadIcon,
  MapPinIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/icons";
import { shortDate, startTime } from "@/lib/event-format";
import { normalizeRole, ROLE_LABELS } from "@/lib/roles";
import { searchWorkspace } from "@/lib/search";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-full animate-pulse rounded-2xl bg-white/70" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-zinc-200/70 bg-white"
          />
        ))}
      </div>
    </div>
  );
}

async function SearchResultsView({ query }: { query: string }) {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const results = await searchWorkspace({ userId: user.id, query });

  if (!query) {
    return (
      <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm shadow-zinc-900/[0.02]">
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title="Search your workspace"
          description="Search events, tasks, templates, teammates and uploaded files across your workspace."
        />
      </section>
    );
  }

  const totalCount =
    results.events.length +
    results.tasks.length +
    results.templates.length +
    results.members.length +
    results.files.length;

  if (totalCount === 0) {
    return (
      <section className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm shadow-zinc-900/[0.02]">
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title={`No results for “${query}”`}
          description="Check your spelling or try broader keywords like event categories, venues, or a teammate's name."
        />
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* Events Results */}
      {results.events.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <CalendarIcon className="h-4 w-4 text-indigo-500" />
              Events ({results.events.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.events.map((event) => {
              const startsAt = new Date(event.startsAt);
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="group flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14.5px] font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600">
                          {event.title}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                          {event.category}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
                          {shortDate.format(startsAt)} at {startTime.format(startsAt)}
                        </span>
                        {event.venue ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                            {event.venue}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-[12.5px] font-semibold text-indigo-600 sm:self-center">
                      Open event →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Tasks Results */}
      {results.tasks.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <CheckCircleSolidIcon className="h-4 w-4 text-emerald-500" />
              Tasks ({results.tasks.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/events/${task.eventId}/tasks`}
                  className="group flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-zinc-900 transition-colors group-hover:text-emerald-600">
                        {task.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          task.status === "done"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {task.status === "done" ? "Done" : "Open"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      In event: <span className="font-semibold text-zinc-700">{task.eventTitle}</span>
                      {task.dueAt ? ` · Due ${shortDate.format(new Date(task.dueAt))}` : ""}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-emerald-600 sm:self-center">
                    View in tasks →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Template Results */}
      {results.templates.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <ColumnsIcon className="h-4 w-4 text-[#1e503c]" />
              Templates ({results.templates.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.templates.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/templates/${template.id}`}
                  className="group flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-zinc-900 transition-colors group-hover:text-[#1e503c]">
                        {template.name}
                      </span>
                      <span className="rounded-full bg-[#eef3ec] px-2 py-0.5 text-[11px] font-semibold text-[#1e503c] ring-1 ring-inset ring-[#dbe6d8]">
                        {template.category}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-zinc-500">
                      {template.description || "No description saved with this template."}
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-400">
                      {template.agendaCount} agenda slots · {template.taskCount}{" "}
                      checklist tasks · {template.isCustom ? "Your template" : "Built-in"}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-[#1e503c] sm:self-center">
                    Preview blueprint →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* People Results */}
      {results.members.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <UsersIcon className="h-4 w-4 text-sky-500" />
              People ({results.members.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.members.map((member) => (
              <li key={`${member.eventId}:${member.id}`}>
                <Link
                  href={`/events/${member.eventId}/members`}
                  className="group flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-zinc-900 transition-colors group-hover:text-sky-700">
                        {member.name}
                      </span>
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-100">
                        {ROLE_LABELS[normalizeRole(member.role)]}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {member.email}
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-400">
                      On {member.eventTitle}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-sky-700 sm:self-center">
                    Open team →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* File Results */}
      {results.files.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
              <DownloadIcon className="h-4 w-4 text-amber-500" />
              Files ({results.files.length})
            </h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {results.files.map((file) => (
              <li key={file.id}>
                <Link
                  href={`/events/${file.eventId}/files`}
                  className="group flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="text-[14px] font-medium text-zinc-900 transition-colors group-hover:text-amber-600">
                      {file.name}
                    </span>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {formatFileSize(file.sizeBytes)} · in {file.eventTitle}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-amber-600 sm:self-center">
                    Open files →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Search"
        description={
          q
            ? `Showing results for “${q}”`
            : "Find events, tasks, templates, people and files across your workspace."
        }
      />

      <form action="/search" method="GET" className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search events, tasks, templates, people, files..."
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-24 text-[13.5px] text-zinc-900 shadow-sm placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-[#193b30] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#245241]"
        >
          Search
        </button>
      </form>

      <Suspense fallback={<SearchSkeleton />}>
        <SearchResultsView query={q} />
      </Suspense>
    </div>
  );
}
