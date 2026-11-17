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
import { PlusIcon, UsersIcon } from "./icons";
import { primaryButton } from "./ui";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

export function InviteMemberForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteMember,
    undefined,
  );
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AssignableRole>("member");
  const [copied, setCopied] = useState(false);

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invitation link", url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={primaryButton}
      >
        <PlusIcon className="h-4 w-4" />
        Invite member
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-member-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm"
        >
          <form
            action={formAction}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-zinc-950/20 sm:p-7"
          >
            <input type="hidden" name="eventId" value={eventId} />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <UsersIcon className="h-[19px] w-[19px]" />
                </span>
                <div>
                  <h3
                    id="invite-member-title"
                    className="text-[16px] font-semibold tracking-tight text-zinc-900"
                  >
                    Invite a member
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                    We&apos;ll email a private link. They get access once they
                    accept it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close invite dialog"
                className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                ×
              </button>
            </div>

            <label
              htmlFor="invite-email"
              className="mb-1.5 mt-6 block text-[12.5px] font-medium text-zinc-700"
            >
              Email address
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={state?.email}
              placeholder="teammate@example.com"
              className={inputClass}
            />

            <label
              htmlFor="invite-role"
              className="mb-1.5 mt-4 block text-[12.5px] font-medium text-zinc-700"
            >
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              value={role}
              onChange={(event) => {
                if (isAssignableRole(event.target.value)) {
                  setRole(event.target.value);
                }
              }}
              className={inputClass}
            >
              {ASSIGNABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
              {ROLE_DESCRIPTIONS[role]}
            </p>

            {state?.error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-600"
              >
                {state.error}
              </p>
            ) : null}

            {state?.success ? (
              <p
                role="status"
                className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-700"
              >
                {state.success}
              </p>
            ) : null}

            {state?.inviteUrl ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Invitation link
                </p>
                <p className="mt-1 break-all text-[12px] leading-relaxed text-zinc-700">
                  {state.inviteUrl}
                </p>
                <button
                  type="button"
                  onClick={() => copyInviteLink(state.inviteUrl ?? "")}
                  className="mt-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button type="submit" disabled={pending} className={primaryButton}>
                <PlusIcon className="h-4 w-4" />
                {pending ? "Sending..." : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
