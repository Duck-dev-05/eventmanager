"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/lib/password-actions";
import type { ResetPasswordState } from "@/lib/password-types";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200/90 bg-zinc-50/60 px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-[12.5px] font-medium text-zinc-600";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetPassword, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium text-emerald-700"
        >
          {state.success}
        </p>

        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Re-enter password"
          className={inputClass}
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600 ring-1 ring-inset ring-rose-100"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>

      <p className="text-center text-[12.5px] text-zinc-500">
        Link expired?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-indigo-600 hover:underline"
        >
          Request a new one
        </Link>
      </p>
    </form>
  );
}
