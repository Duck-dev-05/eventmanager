"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  CopyIcon,
  PrinterIcon,
  ShareIcon,
  UsersIcon,
} from "./icons";

export function ShareMenu({
  eventTitle,
  eventId,
  isOwner,
}: {
  eventTitle: string;
  eventId: string;
  isOwner?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    const url = `${window.location.origin}/events/${eventId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 ${
          open
            ? "border-[#193b30] bg-[#193b30] text-white"
            : "border-[#e4e1d8] bg-white text-[#193b30] hover:border-[#d5cfc2] hover:bg-[#fcfbf8]"
        }`}
      >
        <ShareIcon
          className={`h-4 w-4 ${open ? "text-orange-200" : "text-[#7c8a80]"}`}
        />
        Share
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${
            open ? "rotate-180 text-orange-200" : "text-[#9aa39d]"
          }`}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Share event"
          className="absolute right-0 top-full z-50 mt-2 w-[318px] rounded-2xl border border-[#e8e6de] bg-white shadow-xl shadow-zinc-900/10"
        >
          <div className="flex items-start gap-2.5 px-3.5 pb-3 pt-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f2ec] text-[#5f6b63]">
              <ShareIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-tight text-[#18231d]">
                Share this event
              </p>
              <p className="mt-0.5 truncate text-[11.5px] leading-tight text-zinc-500">
                {eventTitle}
              </p>
            </div>
          </div>

          <div className="px-3.5">
            <div className="rounded-xl border border-[#efede5] bg-[#fbfaf6] p-2">
              <p className="px-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#a39e91]">
                Event link
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-500 ring-1 ring-inset ring-[#eae7de]">
                  /events/{eventId}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-live="polite"
                  className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-[#193b30] text-white hover:bg-[#22493c]"
                  }`}
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {isOwner ? (
            <div className="px-2 pb-1 pt-2">
              <Link
                href={`/events/${eventId}/members`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-[#faf8f3] focus-visible:bg-[#faf8f3] focus-visible:outline-none"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fdf0e4] text-[#c96532]">
                  <UsersIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold leading-tight text-[#18231d]">
                    Invite people
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-zinc-500">
                    Pick a role and send an invitation.
                  </span>
                </span>
              </Link>
            </div>
          ) : null}

          <div className="px-2 pb-1">
            <Link
              href={`/events/${eventId}/print`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-[#faf8f3] focus-visible:bg-[#faf8f3] focus-visible:outline-none"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf4ef] text-[#193b30]">
                <PrinterIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold leading-tight text-[#18231d]">
                  Print run sheet
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-zinc-500">
                  Clean printable schedule and tasks.
                </span>
              </span>
            </Link>
          </div>

          <p className="border-t border-[#f0eee7] px-3.5 py-2.5 text-[11px] leading-snug text-zinc-400">
            Anyone with access to this event can open the link.
          </p>
        </div>
      ) : null}
    </div>
  );
}
