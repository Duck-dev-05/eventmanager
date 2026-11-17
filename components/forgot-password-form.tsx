"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/password-actions";
import type { ForgotPasswordState } from "@/lib/password-types";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200/90 bg-zinc-50/60 px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState,
    FormData
  >(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium text-emerald-700"
        >
          {state.success}
        </p>

        {state.devLink ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Development link
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Email delivery is not configured, so use this link directly:
            </p>
            <Link
              href={state.devLink}
              className="mt-2 block break-all text-[12.5px] font-semibold text-indigo-600 hover:underline"
            >
              {state.devLink}
            </Link>
          </div>
        ) : null}

        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
        >
          Back to sign in
        </Link>

        <p className="text-center text-[12.5px] text-zinc-500">
          Didn&apos;t get an email? Try again in a minute — links expire after 60
          minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[12.5px] font-medium text-zinc-600"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
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
        {pending ? "Sending…" : "Send recovery link"}
      </button>
    </form>
  );
}
