"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "./empty-state";
import { CheckCircleSolidIcon, PulseIcon, UsersIcon } from "./icons";

export type ActivityItem = {
  key: string;
  kind: "created" | "joined";
  eventId: string;
  title: string;
  when: string;
};

const filters = [
  { id: "all", label: "All activity" },
  { id: "created", label: "Created" },
  { id: "joined", label: "Joined" },
] as const;

type Filter = (typeof filters)[number]["id"];

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200/70 bg-white/80 p-1 shadow-sm shadow-zinc-900/[0.02] backdrop-blur sm:w-auto">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all sm:flex-none ${
                filter === id
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] font-medium text-zinc-400">
          {visible.length} {visible.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
        {visible.length === 0 ? (
          <div className="p-2.5">
            <EmptyState
              icon={<PulseIcon className="h-5 w-5" />}
              title={
                filter === "all" ? "No activity yet" : `No ${filter} activity`
              }
              description="Creating or joining an event will add an entry to your activity timeline."
            />
          </div>
        ) : (
          <ol className="divide-y divide-zinc-100">
            {visible.map((item) => {
              const isCreated = item.kind === "created";

              return (
                <li
                  key={item.key}
                  className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-zinc-50/70 sm:px-6"
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                      isCreated
                        ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                        : "bg-indigo-50 text-indigo-600 ring-indigo-100"
                    }`}
                  >
                    {isCreated ? (
                      <CheckCircleSolidIcon className="h-[18px] w-[18px]" />
                    ) : (
                      <UsersIcon className="h-[18px] w-[18px]" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-relaxed text-zinc-600">
                      {isCreated ? "You created " : "You joined "}
                      <Link
                        href={`/events/${item.eventId}`}
                        className="font-semibold text-zinc-900 transition-colors hover:text-indigo-600"
                      >
                        {item.title}
                      </Link>
                    </p>
                    <p className="mt-1 text-[11.5px] text-zinc-400">{item.when}</p>
                  </div>

                  <span className="mt-0.5 hidden shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-500 sm:block">
                    {isCreated ? "Created" : "Joined"}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
