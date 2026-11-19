"use client";

import { useActionState, useState } from "react";
import { inviteMember, type InviteState } from "@/lib/member-actions";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isAssignableRole,
  type AssignableRole,
} from "@/lib/roles";

type InviteEvent = { id: string; title: string };

export function InvitationComposer({ events }: { events: InviteEvent[] }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMember,
    undefined,
  );
  const [role, setRole] = useState<AssignableRole>("member");
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    if (!state?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invitation link", state.inviteUrl);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <div>
        <h2 className="text-[14px] font-semibold text-zinc-900">Invite people</h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          Choose an existing event and send an invitation without leaving this page.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-[12.5px] text-zinc-600">
          There are no events you can invite people to yet. Invitations are linked to an existing event.
        </p>
      ) : (
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-medium text-zinc-700">
            Event
            <select
              name="eventId"
              required
              defaultValue={events[0].id}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </label>

          <label className="text-[12px] font-medium text-zinc-700">
            Email address
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={state?.email}
              placeholder="teammate@example.com"
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="text-[12px] font-medium text-zinc-700">
            Role
            <select
              name="role"
              value={role}
              onChange={(event) => {
                if (isAssignableRole(event.target.value)) setRole(event.target.value);
              }}
              className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {ASSIGNABLE_ROLES.map((option) => (
                <option key={option} value={option}>{ROLE_LABELS[option]}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-zinc-500">
              {ROLE_DESCRIPTIONS[role]}
            </span>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#193b30] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#142e26] disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send invitation"}
            </button>
          </div>

          {state?.error && (
            <p role="alert" className="sm:col-span-2 text-[12px] font-medium text-rose-600">
              {state.error}
            </p>
          )}
          {state?.success && (
            <div role="status" className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
              <p>{state.success}</p>
              {state.inviteUrl && (
                <button type="button" onClick={() => void copyInviteLink()} className="mt-2 font-semibold underline underline-offset-2">
                  {copied ? "Copied" : "Copy invitation link"}
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
