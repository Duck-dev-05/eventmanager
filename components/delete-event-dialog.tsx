"use client";

import { useState } from "react";
import { deleteEventAction } from "@/lib/event-actions";

export function DeleteEventSection({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const isMatch = confirmText.trim().toLowerCase() === eventTitle.trim().toLowerCase();

  return (
    <section className="rounded-3xl border border-rose-200/80 bg-rose-50/40 p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-rose-900">
            Danger Zone
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-rose-700/80">
            Deleting this event will permanently erase all associated schedule items,
            checklists, uploaded files, and invitations. This action cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          Delete event
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <h3 className="text-[17px] font-semibold text-zinc-900">
              Are you absolutely sure?
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
              To confirm deletion of <strong className="text-zinc-900">“{eventTitle}”</strong>,
              please type the event name below:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={eventTitle}
              className="mt-4 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13.5px] outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>

              <form action={deleteEventAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <button
                  type="submit"
                  disabled={!isMatch}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
