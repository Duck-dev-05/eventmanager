"use client";

import { useState } from "react";
import { CalendarDotsIcon, DownloadIcon } from "@/components/icons";
import { rotateCalendarFeed } from "@/lib/calendar-actions";

export function CalendarFeedCard({ feedUrl }: { feedUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CalendarDotsIcon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Calendar feed
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
            Subscribe from Google Calendar, Apple Calendar or Outlook and every
            event you own or join appears automatically.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={feedUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Calendar feed URL"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-xl bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy feed URL"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={feedUrl}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Download .ics
        </a>
        <form action={rotateCalendarFeed}>
          <button
            type="submit"
            className="text-[12px] font-semibold text-zinc-500 transition-colors hover:text-zinc-800"
          >
            Reset link
          </button>
        </form>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400">
        Anyone with this link can read your event list. Resetting it breaks
        existing subscriptions until you re-add the new URL.
      </p>
    </div>
  );
}
