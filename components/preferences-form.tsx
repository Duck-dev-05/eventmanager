"use client";

import { useActionState } from "react";
import {
  updatePreferences,
  type PreferencesState,
} from "@/lib/account-actions";
import type { Preferences } from "@/lib/preferences";
import { CheckCircleSolidIcon } from "./icons";
import { primaryButton } from "./ui";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 py-4 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-zinc-900">
          {label}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-zinc-500">
          {description}
        </span>
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-zinc-200 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function PreferencesForm({
  preferences,
}: {
  preferences: Preferences;
}) {
  const [state, formAction, pending] = useActionState<
    PreferencesState,
    FormData
  >(updatePreferences, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          Notifications
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Choose what you want to hear about, and how often.
        </p>
        <div className="mt-4 divide-y divide-zinc-100">
          <Toggle
            name="eventReminders"
            label="Event reminders"
            description="A reminder before events you run or collaborate on start."
            defaultChecked={preferences.eventReminders}
          />
          <Toggle
            name="emailUpdates"
            label="Event updates"
            description="Changes to guest lists, schedules and team membership."
            defaultChecked={preferences.emailUpdates}
          />
          <Toggle
            name="weeklyDigest"
            label="Weekly digest"
            description="A short Monday summary of what is coming up in your workspace."
            defaultChecked={preferences.weeklyDigest}
          />
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          Event defaults
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Values used to pre-fill the create event form.
        </p>
        <div className="mt-4 max-w-xs">
          <label
            htmlFor="default-capacity"
            className="mb-1.5 block text-[12.5px] font-medium text-zinc-600"
          >
            Default capacity
          </label>
          <input
            id="default-capacity"
            name="defaultCapacity"
            type="number"
            min={1}
            max={100000}
            inputMode="numeric"
            placeholder="No limit"
            defaultValue={preferences.defaultCapacity ?? ""}
            className={inputClass}
          />
          <p className="mt-1.5 text-[11.5px] text-zinc-400">
            Leave empty for unlimited capacity.
          </p>
        </div>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-600"
        >
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-700"
        >
          <CheckCircleSolidIcon className="h-4 w-4" />
          {state.success}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4">
        <p className="text-[11.5px] text-zinc-400">
          {preferences.updatedAt
            ? `Last saved ${new Date(preferences.updatedAt).toLocaleString("en-US")}`
            : "Using the default preferences."}
        </p>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
