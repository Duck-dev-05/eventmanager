"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { DeleteEventSection } from "@/components/delete-event-dialog";
import {
  CalendarDotsIcon,
  CalendarIcon,
  CheckCircleSolidIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  SettingsIcon,
  ShieldIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons";
import { eventCategories, type EventFormState, type EventFormValues } from "@/lib/event-types";
import { primaryButton, secondaryButton } from "./ui";

type EventSettingsAction = (
  state: EventFormState,
  formData: FormData,
) => Promise<EventFormState>;

const inputClass =
  "h-11 w-full rounded-xl border border-[#e5e2d9] bg-[#fcfbf8] px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:bg-white focus:ring-4 focus:ring-[#f6e3d2]/70";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500";
const helperClass = "mt-1.5 text-[11.5px] leading-relaxed text-zinc-400";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function displayDate(value?: string) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "Not set";
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

function displayTime(value?: string) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

const shortcuts = [
  {
    href: "schedule",
    label: "Timeline & schedule",
    hint: "Sessions and run order",
    Icon: CalendarDotsIcon,
  },
  {
    href: "members",
    label: "Team & invitations",
    hint: "Roles and access",
    Icon: UsersIcon,
  },
  {
    href: "files",
    label: "Files & slide decks",
    hint: "Uploads and documents",
    Icon: FileTextIcon,
  },
  {
    href: "tasks",
    label: "Checklist & tasks",
    hint: "Owners and progress",
    Icon: CheckCircleSolidIcon,
  },
];

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
      <header className="flex items-start gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
            {description}
          </p>
        </div>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

export function EventSettingsView({
  eventId,
  action,
  initialValues,
  createdAt,
  hostName,
  hostEmail,
  isSaved,
}: {
  eventId: string;
  action: EventSettingsAction;
  initialValues: Partial<EventFormValues>;
  createdAt: string;
  hostName: string;
  hostEmail: string;
  isSaved?: boolean;
}) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    action,
    undefined,
  );
  const [copiedId, setCopiedId] = useState(false);

  const values = state?.values ?? initialValues ?? {};

  async function copyEventId() {
    try {
      await navigator.clipboard.writeText(eventId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
    }
  }

  const createdDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(createdAt));

  return (
    <div className="space-y-5">
      {/* Host header */}
      <section className="relative overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <div className="absolute -right-14 -top-24 h-52 w-52 rounded-full bg-gradient-to-br from-orange-100/70 to-emerald-50/50 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#193b30] text-white shadow-sm">
              <SettingsIcon className="h-5 w-5 text-orange-200" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1e4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a4c20] ring-1 ring-[#f4d7bd]">
                  <ShieldIcon className="h-3 w-3" />
                  Host controls
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  Host only
                </span>
              </div>
              <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-[#18231d]">
                Event settings
              </h1>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-zinc-500">
                Update how this event appears to guests and teammates. Changes
                take effect as soon as you save.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={copyEventId}
              className={`${secondaryButton} h-9 px-3 text-[12px]`}
              title="Copy event ID"
            >
              <CopyIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span aria-live="polite">{copiedId ? "ID copied" : "Copy ID"}</span>
            </button>
            <Link
              href={`/events/${eventId}/print`}
              className={`${secondaryButton} h-9 px-3 text-[12px]`}
            >
              Print run sheet
            </Link>
            <button
              type="submit"
              form="event-settings-form"
              disabled={pending}
              className={`${primaryButton} h-9 px-3.5 text-[12px]`}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#f0ede5] bg-[#fcfbf8] px-5 py-3 text-[11.5px] text-zinc-500 sm:px-7">
          <span className="inline-flex items-center gap-1.5">
            Hosted by
            <span className="font-semibold text-zinc-700">{hostName}</span>
          </span>
          {hostEmail ? (
            <a
              href={`mailto:${hostEmail}`}
              className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-[#193b30] hover:underline"
            >
              <MailIcon className="h-3.5 w-3.5 text-zinc-400" />
              {hostEmail}
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
            Created {createdDate}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <TicketIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="font-mono text-[11px] text-zinc-500">ID</span>
            <span className="max-w-[160px] truncate font-mono text-[11px] text-zinc-600">
              {eventId}
            </span>
          </span>
        </div>
      </section>

      {/* Feedback banners */}
      {isSaved ? (
        <div
          role="status"
          className="animate-rise-in flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[12.5px] text-emerald-900"
        >
          <CheckCircleSolidIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            <span className="font-semibold">Settings saved.</span>{" "}
            Your event details, schedule and notifications are up to date.
          </p>
        </div>
      ) : null}

      {state?.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-800"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
          <p className="font-medium">{state.error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Settings form */}
        <div className="space-y-5">
          <form id="event-settings-form" action={formAction} className="space-y-5">
            <input
              type="hidden"
              name="returnTo"
              value={`/events/${eventId}/settings?saved=true`}
            />

            <SettingsSection
              icon={<TicketIcon className="h-[18px] w-[18px]" />}
              title="Event details"
              description="The headline, category and description guests see first."
            >
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
                  placeholder="e.g. Annual Design Summit"
                  className={`${inputClass} text-[14px] font-medium`}
                />
                <p className={helperClass}>
                  Short and descriptive — it appears at the top of every event
                  page and run sheet.
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
                        defaultChecked={(values.category ?? "Conference") === category}
                        className="peer sr-only"
                      />
                      <span className="inline-flex items-center rounded-full border border-[#e5e2d9] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-600 transition-colors hover:border-[#d5cfc2] hover:bg-[#fcfbf8] peer-checked:border-[#193b30] peer-checked:bg-[#193b30] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#e4c9a8]">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="description" className={labelClass}>
                  Description & notes
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  defaultValue={values.description}
                  placeholder="Outline the schedule, target audience, or special instructions."
                  className="min-h-[120px] w-full rounded-xl border border-[#e5e2d9] bg-[#fcfbf8] px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:bg-white focus:ring-4 focus:ring-[#f6e3d2]/70"
                />
                <p className={helperClass}>
                  Optional. Line breaks and paragraphs are preserved.
                </p>
              </div>
            </SettingsSection>

            <SettingsSection
              icon={<CalendarDotsIcon className="h-[18px] w-[18px]" />}
              title="Time and location"
              description="When the event starts and where guests should arrive."
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="date" className={labelClass}>
                    Event date
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
                    Venue / location
                  </label>
                  <div className="relative">
                    <MapPinIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="venue"
                      name="venue"
                      type="text"
                      defaultValue={values.venue}
                      placeholder="Grand Ballroom or online link"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                  <p className={helperClass}>
                    Leave blank to show “Location to be announced”.
                  </p>
                </div>

                <div>
                  <label htmlFor="capacity" className={labelClass}>
                    Guest capacity limit
                  </label>
                  <div className="relative">
                    <UsersIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      defaultValue={values.capacity}
                      placeholder="Unlimited"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                  <p className={helperClass}>Leave blank for no guest limit.</p>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              icon={<ShieldIcon className="h-[18px] w-[18px]" />}
              title="Visibility & access"
              description="Decide who can open this event inside your workspace."
            >
              <fieldset>
                <legend className={labelClass}>Who can open this event</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value: "private",
                      label: "Private",
                      description:
                        "Only you and invited members can open it. This is the default.",
                      Icon: ShieldIcon,
                    },
                    {
                      value: "public",
                      label: "Public",
                      description:
                        "Anyone signed in to this workspace can open the link and read it, without editing.",
                      Icon: UsersIcon,
                    },
                  ].map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        defaultChecked={
                          (values.visibility ?? "private") === option.value
                        }
                        className="peer sr-only"
                      />
                      <span className="block rounded-xl border border-[#e5e2d9] bg-white p-4 transition peer-checked:border-[#193b30] peer-checked:bg-[#f5f8f4] peer-checked:ring-2 peer-checked:ring-[#193b30]/15 peer-focus-visible:ring-2 peer-focus-visible:ring-[#e4c9a8]">
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
                          <option.Icon className="h-4 w-4 text-[#193b30]" />
                          {option.label}
                        </span>
                        <span className="mt-1 block text-[11.5px] leading-relaxed text-zinc-500">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className={helperClass}>
                  Public events stay unlisted — teammates need the link, and they
                  get read-only access. Saving changes applies immediately.
                </p>
              </fieldset>
            </SettingsSection>

            {/* Save actions */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e4e1d8] bg-gradient-to-r from-[#fcfbf8] to-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="flex items-center gap-2 text-[12px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Changes apply to the workspace once saved.
              </p>
              <div className="flex items-center gap-2.5 sm:justify-end">
                <Link
                  href={`/events/${eventId}`}
                  className={`${secondaryButton} h-10`}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={pending}
                  className={`${primaryButton} h-10`}
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </form>

          <DeleteEventSection
            eventId={eventId}
            eventTitle={values.title ?? "this event"}
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 xl:sticky xl:top-[92px]">
          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold tracking-tight text-[#18231d]">
                  At a glance
                </h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  What guests currently see.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#fff1e4] px-2.5 py-1 text-[10.5px] font-semibold text-[#9a4c20] ring-1 ring-[#f4d7bd]">
                {values.category ?? "Conference"}
              </span>
            </div>

            <dl className="space-y-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fcfbf8] text-zinc-400 ring-1 ring-[#f0ede5]">
                  <TicketIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Event
                  </dt>
                  <dd className="mt-0.5 truncate text-[12.5px] font-medium text-zinc-800">
                    {values.title || "Untitled event"}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fcfbf8] text-zinc-400 ring-1 ring-[#f0ede5]">
                  <CalendarIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    When
                  </dt>
                  <dd className="mt-0.5 text-[12.5px] font-medium text-zinc-800">
                    {displayDate(values.date)}
                    {values.time ? (
                      <span className="block text-[11.5px] font-normal text-zinc-500">
                        Starts {displayTime(values.time)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fcfbf8] text-zinc-400 ring-1 ring-[#f0ede5]">
                  <MapPinIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Where
                  </dt>
                  <dd className="mt-0.5 text-[12.5px] font-medium text-zinc-800">
                    {values.venue || "Location to be announced"}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fcfbf8] text-zinc-400 ring-1 ring-[#f0ede5]">
                  <UsersIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Guests
                  </dt>
                  <dd className="mt-0.5 text-[12.5px] font-medium text-zinc-800">
                    {values.capacity ? `Up to ${values.capacity}` : "No limit"}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fcfbf8] text-zinc-400 ring-1 ring-[#f0ede5]">
                  <ShieldIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Access
                  </dt>
                  <dd className="mt-0.5 text-[12.5px] font-medium text-zinc-800">
                    {(values.visibility ?? "private") === "public"
                      ? "Public (workspace read-only)"
                      : "Private (invited members)"}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="border-t border-[#f0ede5] px-5 py-3 text-[11px] text-zinc-400">
              Updates here after you save.
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
            <div className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
              <h2 className="text-[14px] font-semibold tracking-tight text-[#18231d]">
                Go to
              </h2>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Jump to another area of this event.
              </p>
            </div>

            <ul className="divide-y divide-[#f2efe8]">
              {shortcuts.map(({ href, label, hint, Icon }) => (
                <li key={href}>
                  <Link
                    href={`/events/${eventId}/${href}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#fcfbf8]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 ring-1 ring-zinc-100 transition-colors group-hover:bg-[#fff1e4] group-hover:text-[#c96532] group-hover:ring-[#f4d7bd]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-zinc-800">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-400">
                        {hint}
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#c96532]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-gradient-to-b from-[#fdfbf6] to-[#faf8f2]">
            <div className="px-5 py-4">
              <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#18231d]">
                <ShieldIcon className="h-4 w-4 text-amber-600" />
                Host authority
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
                As the host, you hold master permissions over this workspace.
                Only you can change foundational settings, reassign roles, or
                permanently delete the event.
              </p>
            </div>

            <div className="mx-5 mb-5 rounded-xl border border-[#ecdfc9] bg-white/80 px-3.5 py-3 text-[11.5px] leading-relaxed text-zinc-500">
              <span className="font-semibold text-zinc-700">
                Need to hand it over?
              </span>
              <br />
              Promote a collaborator in Members to share administrator rights.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
