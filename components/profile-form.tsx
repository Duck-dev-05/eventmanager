"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/account-actions";
import { UserIcon } from "./icons";
import { primaryButton } from "./ui";

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-[12.5px] font-medium text-zinc-600";

export function ProfileForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="profile-name" className={labelClass}>
          Display name
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          defaultValue={state?.name ?? name}
          className={inputClass}
        />
        <p className="mt-1.5 text-[11.5px] text-zinc-400">
          This is the name shown in the sidebar and on the events you run.
        </p>
      </div>

      <div>
        <label htmlFor="profile-email" className={labelClass}>
          Email address
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          readOnly
          disabled
          className={`${inputClass} cursor-not-allowed bg-zinc-50 text-zinc-500`}
        />
        <p className="mt-1.5 text-[11.5px] text-zinc-400">
          Your email is used to sign in and cannot be changed here.
        </p>
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
          {state.success}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-zinc-100 pt-4">
        <button type="submit" disabled={pending} className={primaryButton}>
          <UserIcon className="h-4 w-4" />
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
