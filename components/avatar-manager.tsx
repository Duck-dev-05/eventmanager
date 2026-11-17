"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/avatar";
import {
  removeAvatar,
  uploadAvatar,
  useGoogleAvatar,
  type AvatarState,
} from "@/lib/avatar-actions";

export function AvatarManager({
  initials,
  avatarUrl,
  hasGooglePhoto,
}: {
  initials: string;
  avatarUrl?: string;
  hasGooglePhoto: boolean;
}) {
  const [state, formAction, pending] = useActionState<AvatarState, FormData>(
    uploadAvatar,
    undefined,
  );

  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-center gap-3">
        <Avatar initials={initials} src={avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900">
            Profile photo
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
            PNG, JPEG or WebP up to 2 MB.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-3 space-y-2">
        <input
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp"
          required
          className="block w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-600 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-[11.5px] file:font-semibold file:text-zinc-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload photo"}
        </button>
      </form>

      {state?.error ? (
        <p className="mt-2 text-[12px] font-medium text-red-600">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="mt-2 text-[12px] font-medium text-emerald-600">
          {state.success}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {hasGooglePhoto ? (
          <form action={useGoogleAvatar}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Use Google photo
            </button>
          </form>
        ) : null}
        <form action={removeAvatar}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Remove photo
          </button>
        </form>
      </div>
    </div>
  );
}
