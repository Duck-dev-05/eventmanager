"use client";

import { useActionState, useState } from "react";
import {
  sendWorkspaceInvitationAction,
  type WorkspaceInvitationState,
} from "@/lib/workspace-invitation-actions";

export function InvitationComposer() {
  const [state, formAction, pending] = useActionState<WorkspaceInvitationState, FormData>(
    sendWorkspaceInvitationAction,
    undefined,
  );
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
          Invite someone to join EventPulse. They can be added to an event later.
        </p>
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-[12px] font-medium text-zinc-700">
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
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#193b30] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#142e26] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </form>

      {state?.error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-rose-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <div role="status" className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
          <p>{state.success}</p>
          {state.inviteUrl && (
            <button type="button" onClick={() => void copyInviteLink()} className="mt-2 font-semibold underline underline-offset-2">
              {copied ? "Copied" : "Copy invitation link"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
