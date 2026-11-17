"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgendaItem, AgendaItemStatus } from "@/lib/agenda";
import {
  createAgendaItemAction,
  deleteAgendaItemAction,
  setAgendaItemStatusAction,
  updateAgendaItemAction,
  type AgendaActionState,
} from "@/lib/agenda-actions";
import {
  CalendarDotsIcon,
  CheckCircleSolidIcon,
  ClockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  PulseIcon,
  TrashIcon,
  UserIcon,
} from "./icons";
import { primaryButton, secondaryButton } from "./ui";
import { InlineNotice } from "./inline-notice";

const inputClass =
  "h-11 w-full rounded-xl border border-[#e5e2d9] bg-[#fcfbf8] px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:bg-white focus:ring-4 focus:ring-[#f6e3d2]/70";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500";

const PRESET_SUGGESTIONS = [
  { title: "Registration & Welcome", durationMinutes: 45, location: "Main Lobby" },
  { title: "Opening Keynote", durationMinutes: 60, location: "Main Stage" },
  { title: "Panel Discussion", durationMinutes: 45, location: "Main Stage" },
  { title: "Coffee & Networking", durationMinutes: 30, location: "Lounge Area" },
  { title: "Interactive Workshop", durationMinutes: 90, location: "Room 101" },
  { title: "Lunch Break", durationMinutes: 60, location: "Dining Hall" },
  { title: "Q&A Session", durationMinutes: 30, location: "Main Stage" },
  { title: "Closing Remarks", durationMinutes: 20, location: "Main Stage" },
];

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours} hr`;
}

function calculateEndTime(startsAt: string, durationMinutes: number): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function toLocalTimeInputValue(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "09:00";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toLocalDateInputValue(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const statusToneMap: Record<
  AgendaItemStatus,
  {
    badge: string;
    iconBg: string;
    iconColor: string;
    label: string;
  }
> = {
  scheduled: {
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    iconBg: "bg-[#fff1e4] ring-[#f4d7bd]",
    iconColor: "text-[#c96532]",
    label: "Scheduled",
  },
  live: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200 animate-pulse",
    iconBg: "bg-emerald-50 ring-emerald-200",
    iconColor: "text-emerald-600",
    label: "LIVE NOW",
  },
  completed: {
    badge: "bg-zinc-100 text-zinc-500 ring-zinc-200",
    iconBg: "bg-zinc-100 ring-zinc-200",
    iconColor: "text-zinc-500",
    label: "Completed",
  },
  cancelled: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    iconBg: "bg-rose-50 ring-rose-200",
    iconColor: "text-rose-500",
    label: "Cancelled",
  },
};

// --- CREATE MODAL ---
function CreateAgendaDialog({
  eventId,
  eventStartsAt,
  defaultVenue,
  onClose,
}: {
  eventId: string;
  eventStartsAt: string;
  defaultVenue?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AgendaActionState, FormData>(
    createAgendaItemAction,
    undefined,
  );

  const [selectedTitle, setSelectedTitle] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("45");
  const [selectedLocation, setSelectedLocation] = useState(defaultVenue || "");

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose, router]);

  function handleSelectPreset(preset: (typeof PRESET_SUGGESTIONS)[number]) {
    setSelectedTitle(preset.title);
    setSelectedDuration(String(preset.durationMinutes));
    if (preset.location) setSelectedLocation(preset.location);
  }

  const defaultDate = toLocalDateInputValue(eventStartsAt);
  const defaultTime = toLocalTimeInputValue(eventStartsAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e8e6de] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#f0ede5] bg-[#fcfbf8]/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
              <CalendarDotsIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[#18231d]">
                Add agenda session
              </h2>
              <p className="text-[12px] text-zinc-500">
                Plan timeline activities, keynote talks and breaks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </header>

        <form action={formAction} className="space-y-4 p-6">
          <input type="hidden" name="eventId" value={eventId} />

          {/* Quick presets */}
          <div>
            <label className={labelClass}>Quick suggestions</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="rounded-full border border-[#e5e2d9] bg-[#fcfbf8] px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-[#d9773e] hover:bg-[#fffaf2] hover:text-[#9a4c20]"
                >
                  + {preset.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="create-title" className={labelClass}>
              Session title *
            </label>
            <input
              id="create-title"
              name="title"
              type="text"
              required
              placeholder="e.g. Opening Keynote & Welcome"
              value={selectedTitle}
              onChange={(e) => setSelectedTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="create-date" className={labelClass}>
                Date
              </label>
              <input
                id="create-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="create-time" className={labelClass}>
                Start time *
              </label>
              <input
                id="create-time"
                name="time"
                type="time"
                required
                defaultValue={defaultTime}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="create-duration" className={labelClass}>
                Duration (minutes)
              </label>
              <select
                id="create-duration"
                name="durationMinutes"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                className={inputClass}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes (1 hr)</option>
                <option value="90">90 minutes (1.5 hrs)</option>
                <option value="120">120 minutes (2 hrs)</option>
                <option value="180">180 minutes (3 hrs)</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-location" className={labelClass}>
                Room / Stage / Link
              </label>
              <input
                id="create-location"
                name="location"
                type="text"
                placeholder="e.g. Main Auditorium"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="create-speaker" className={labelClass}>
              Speaker / Host name
            </label>
            <input
              id="create-speaker"
              name="speakerName"
              type="text"
              placeholder="e.g. Alex Morgan (Head of Design)"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="create-description" className={labelClass}>
              Description / Notes
            </label>
            <textarea
              id="create-description"
              name="description"
              rows={2}
              placeholder="Outline topics covered, slide links, or special equipment required."
              className="w-full resize-none rounded-xl border border-[#e5e2d9] bg-[#fcfbf8] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:bg-white focus:ring-4 focus:ring-[#f6e3d2]/70"
            />
          </div>

          {state?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12px] text-rose-700">
              {state.error}
            </p>
          ) : null}

          {state?.success ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] text-emerald-800">
              ✓ {state.success}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={`${secondaryButton} h-10 px-4 text-[12.5px]`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${primaryButton} h-10 px-4 text-[12.5px]`}
            >
              {pending ? "Adding…" : "Add to schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- EDIT MODAL ---
function EditAgendaDialog({
  eventId,
  item,
  onClose,
}: {
  eventId: string;
  item: AgendaItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AgendaActionState, FormData>(
    updateAgendaItemAction,
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose, router]);

  const defaultDate = toLocalDateInputValue(item.startsAt);
  const defaultTime = toLocalTimeInputValue(item.startsAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e8e6de] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#f0ede5] bg-[#fcfbf8]/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
              <PencilIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[#18231d]">
                Edit session
              </h2>
              <p className="text-[12px] text-zinc-500">
                Update timeline item details and timing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </header>

        <form action={formAction} className="space-y-4 p-6">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="itemId" value={item.id} />

          <div>
            <label htmlFor="edit-title" className={labelClass}>
              Session title *
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              required
              defaultValue={item.title}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-date" className={labelClass}>
                Date
              </label>
              <input
                id="edit-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-time" className={labelClass}>
                Start time *
              </label>
              <input
                id="edit-time"
                name="time"
                type="time"
                required
                defaultValue={defaultTime}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-duration" className={labelClass}>
                Duration (minutes)
              </label>
              <select
                id="edit-duration"
                name="durationMinutes"
                defaultValue={String(item.durationMinutes)}
                className={inputClass}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes (1 hr)</option>
                <option value="90">90 minutes (1.5 hrs)</option>
                <option value="120">120 minutes (2 hrs)</option>
                <option value="180">180 minutes (3 hrs)</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-status" className={labelClass}>
                Status
              </label>
              <select
                id="edit-status"
                name="status"
                defaultValue={item.status}
                className={inputClass}
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live now</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-location" className={labelClass}>
                Location / Stage
              </label>
              <input
                id="edit-location"
                name="location"
                type="text"
                defaultValue={item.location}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-speaker" className={labelClass}>
                Speaker / Host
              </label>
              <input
                id="edit-speaker"
                name="speakerName"
                type="text"
                defaultValue={item.speakerName}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-description" className={labelClass}>
              Description / Notes
            </label>
            <textarea
              id="edit-description"
              name="description"
              rows={3}
              defaultValue={item.description}
              className="w-full resize-none rounded-xl border border-[#e5e2d9] bg-[#fcfbf8] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-[#d9773e] focus:bg-white focus:ring-4 focus:ring-[#f6e3d2]/70"
            />
          </div>

          {state?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12px] text-rose-700">
              {state.error}
            </p>
          ) : null}

          {state?.success ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] text-emerald-800">
              ✓ {state.success}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={`${secondaryButton} h-10 px-4 text-[12.5px]`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${primaryButton} h-10 px-4 text-[12.5px]`}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN AGENDALIST COMPONENT ---
export function EventAgendaList({
  eventId,
  eventStartsAt,
  defaultVenue,
  items,
  canEdit,
  canDelete,
}: {
  eventId: string;
  eventStartsAt: string;
  defaultVenue?: string;
  items: AgendaItem[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | AgendaItemStatus>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  function handleDelete(item: AgendaItem) {
    if (!confirm(`Delete “${item.title}”? This cannot be undone.`)) return;

    setBusyId(item.id);
    startTransition(async () => {
      const res = await deleteAgendaItemAction(eventId, item.id);
      setBusyId(null);
      if (res.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete item.",
        });
      }
    });
  }

  function handleSetStatus(item: AgendaItem, nextStatus: AgendaItemStatus) {
    setBusyId(item.id);
    startTransition(async () => {
      const res = await setAgendaItemStatusAction(eventId, item.id, nextStatus);
      setBusyId(null);
      if (res.success) {
        router.refresh();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to update status.",
        });
      }
    });
  }

  const liveCount = items.filter((i) => i.status === "live").length;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
              Timeline & Sessions
            </h2>
            <span className="rounded-full bg-[#fff1e4] px-2 py-0.5 text-[11px] font-semibold text-[#9a4c20] ring-1 ring-[#f4d7bd]">
              {items.length} {items.length === 1 ? "session" : "sessions"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Chronological run order of sessions, speakers, and milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className={primaryButton}
            >
              <PlusIcon className="h-4 w-4" />
              Add session
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>
      ) : null}

      {/* Filter tabs */}
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#f0ede5] bg-[#faf8f2]/50 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              filter === "all"
                ? "bg-[#193b30] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900"
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("scheduled")}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              filter === "scheduled"
                ? "bg-[#193b30] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900"
            }`}
          >
            Scheduled ({scheduledCount})
          </button>
          {liveCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("live")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
                filter === "live"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
              Live ({liveCount})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${
              filter === "completed"
                ? "bg-[#193b30] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>
      ) : null}

      {/* Timeline items list */}
      <div className="p-5 sm:p-6">
        {filteredItems.length > 0 ? (
          <ol className="relative space-y-6 border-l-2 border-[#eeebe3] pl-6 sm:pl-8">
            {filteredItems.map((item) => {
              const tone = statusToneMap[item.status];
              const isBusy = pending && busyId === item.id;
              const timeRange = calculateEndTime(item.startsAt, item.durationMinutes);

              return (
                <li key={item.id} className="relative group">
                  {/* Status node */}
                  <span
                    className={`absolute -left-[35px] sm:-left-[43px] flex h-8 w-8 items-center justify-center rounded-xl ring-1 shadow-xs transition-transform duration-150 group-hover:scale-105 ${tone.iconBg} ${tone.iconColor}`}
                  >
                    {item.status === "live" ? (
                      <PulseIcon className="h-4 w-4 animate-pulse" />
                    ) : item.status === "completed" ? (
                      <CheckCircleSolidIcon className="h-4 w-4" />
                    ) : (
                      <ClockIcon className="h-4 w-4" />
                    )}
                  </span>

                  <div className="rounded-xl border border-[#ece9e1] bg-[#fdfcf9]/80 p-4 transition-all hover:border-[#ded9cb] hover:bg-white hover:shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${tone.badge}`}
                          >
                            {tone.label}
                          </span>
                          <span className="text-[12px] font-semibold text-zinc-700">
                            {timeRange}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-500">
                            {formatDuration(item.durationMinutes)}
                          </span>
                        </div>

                        <h3 className="mt-1.5 text-[14.5px] font-semibold leading-tight text-[#18231d]">
                          {item.title}
                        </h3>

                        {item.description ? (
                          <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-zinc-600">
                            {item.description}
                          </p>
                        ) : null}

                        {/* Metadata badges: Room & Speaker */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-zinc-500">
                          {item.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                              <span className="font-medium text-zinc-700">
                                {item.location}
                              </span>
                            </span>
                          ) : null}

                          {item.speakerName ? (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3.5 w-3.5 text-zinc-400" />
                              <span className="font-medium text-zinc-700">
                                {item.speakerName}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Interactive Actions */}
                      <div className="flex items-center gap-1 self-start">
                        {canEdit ? (
                          <>
                            {item.status === "scheduled" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSetStatus(item, "live")}
                                title="Mark session as live now"
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Go live
                              </button>
                            ) : item.status === "live" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSetStatus(item, "completed")}
                                title="Mark session as completed"
                                className="rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-200"
                              >
                                Finish
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleSetStatus(item, "scheduled")}
                                title="Reset back to scheduled"
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
                              >
                                Reset
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              title="Edit session details"
                              aria-label={`Edit ${item.title}`}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}

                        {canDelete ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(item)}
                            title="Delete session"
                            aria-label={`Delete ${item.title}`}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1e4] text-[#c96532] ring-1 ring-[#f4d7bd]">
              <CalendarDotsIcon className="h-6 w-6" />
            </span>
            <h3 className="mt-3 text-[14.5px] font-semibold text-[#18231d]">
              {items.length === 0
                ? "No agenda sessions added yet"
                : "No sessions match this filter"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
              {items.length === 0
                ? "Break down your event into keynotes, workshops, breaks, and networking sessions."
                : "Try switching back to 'All' to view the entire timeline."}
            </p>
            {canEdit && items.length === 0 ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className={primaryButton}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add first session
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {isCreateOpen ? (
        <CreateAgendaDialog
          eventId={eventId}
          eventStartsAt={eventStartsAt}
          defaultVenue={defaultVenue}
          onClose={() => setIsCreateOpen(false)}
        />
      ) : null}

      {editingItem ? (
        <EditAgendaDialog
          eventId={eventId}
          item={editingItem}
          onClose={() => setEditingItem(null)}
        />
      ) : null}
    </section>
  );
}
