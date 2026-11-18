"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  eventCategories,
  type EventFormState,
  type EventFormValues,
} from "@/lib/event-types";
import { primaryButton, secondaryButton } from "./ui";
import {
  BoltIcon,
  CalendarDotsIcon,
  CalendarIcon,
  CheckCircleSolidIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  UsersIcon,
} from "./icons";

type EventAction = (
  state: EventFormState,
  formData: FormData,
) => Promise<EventFormState>;

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-[12.5px] font-medium text-zinc-600";
const helperClass = "mt-1.5 text-[11.5px] text-zinc-400";

function SectionCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
            {hint}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function EventForm({
  action,
  initialValues,
  submitLabel = "Publish event",
  pendingLabel = "Publishing...",
  cancelHref = "/my-events",
}: {
  action: EventAction;
  initialValues?: Partial<EventFormValues>;
  submitLabel?: string;
  pendingLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    action,
    undefined,
  );
  const values = state?.values ?? initialValues ?? {};

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form action={formAction} className="space-y-5">
        <SectionCard
          icon={<TicketIcon className="h-[18px] w-[18px]" />}
          title="Event details"
          hint="The name, category and story guests read first."
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>
                Event title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                minLength={3}
                defaultValue={values.title}
                placeholder="Product launch night"
                className={`${inputClass} text-[14px] font-medium`}
              />
              <p className={helperClass}>
                Keep it short and specific — it is the headline of the page.
              </p>
            </div>

            <fieldset>
              <legend className={labelClass}>Category</legend>
              <div className="flex flex-wrap gap-2">
                {eventCategories.map((category) => (
                  <label key={category} className="cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      value={category}
                      defaultChecked={
                        (values.category ?? "Conference") === category
                      }
                      className="peer sr-only"
                    />
                    <span className="inline-flex items-center rounded-full border border-zinc-200 px-3.5 py-2 text-[12.5px] font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                defaultValue={values.description}
                placeholder="What happens, who it is for, and what guests should bring."
                className="min-h-[140px] w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <p className={helperClass}>
                Optional. Line breaks are kept as you type them.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={<CalendarDotsIcon className="h-[18px] w-[18px]" />}
          title="When and where"
          hint="The schedule and place guests should arrive at."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className={labelClass}>
                Date
              </label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={values.date}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="time" className={labelClass}>
                Start time
              </label>
              <div className="relative">
                <ClockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="time"
                  name="time"
                  type="time"
                  required
                  defaultValue={values.time}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="venue" className={labelClass}>
                Venue
              </label>
              <div className="relative">
                <MapPinIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="venue"
                  name="venue"
                  type="text"
                  defaultValue={values.venue}
                  placeholder="Riverside Hall, District 1"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="capacity" className={labelClass}>
                Capacity
              </label>
              <div className="relative">
                <UsersIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={values.capacity}
                  placeholder="No limit"
                  className={`${inputClass} pl-10`}
                />
              </div>
              <p className={helperClass}>Leave empty for an unlimited guest list.</p>
            </div>
          </div>
        </SectionCard>

        {state?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-600"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[12.5px] leading-relaxed text-zinc-500">
            Publishing adds this event to My Events right away.
          </p>
          <div className="flex items-center gap-3">
            <Link href={cancelHref} className={secondaryButton}>
              Cancel
            </Link>
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>
      </form>

      <aside className="space-y-5 xl:sticky xl:top-[92px]">
        <section className="relative overflow-hidden rounded-2xl bg-nav p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-indigo-500/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 -right-6 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
          <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Guest view
          </p>
          <h2 className="relative mt-2 text-[16px] font-semibold leading-snug tracking-tight">
            What shows on the event page
          </h2>
          <ul className="relative mt-4 space-y-3 text-[12.5px] leading-relaxed text-slate-400">
            <li className="flex items-start gap-2.5">
              <TicketIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
              Title, category and description at the top.
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarDotsIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
              Date and start time in the schedule block.
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
              Venue, or “Location to be announced” when empty.
            </li>
            <li className="flex items-start gap-2.5">
              <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
              Capacity as the guest limit on the page.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <h2 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-zinc-900">
            <BoltIcon className="h-4 w-4 text-indigo-500" />
            Before you publish
          </h2>
          <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-zinc-500">
            <li className="flex items-start gap-2">
              <CheckCircleSolidIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              A title of at least 3 characters and a date are required.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleSolidIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Capacity must be a whole number when you set one.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircleSolidIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              Only you can open the event from your workspace.
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
