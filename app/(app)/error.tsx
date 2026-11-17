"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error ? (error as Error & { digest?: string }).digest : "";

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200/70 bg-white p-8 text-center shadow-sm shadow-zinc-900/[0.02]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100">
          <CalendarIcon className="h-6 w-6" />
        </span>

        <h1 className="mt-5 text-[22px] font-semibold leading-tight tracking-tight text-[#18231d]">
          This page couldn&apos;t load
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
          Something went wrong while rendering this screen. Trying again often
          fixes it — the database or a file may have been briefly busy.
        </p>

        {digest ? (
          <p className="mt-3 text-[11.5px] text-zinc-400">
            Reference: <span className="font-mono">{digest}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#193b30] px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#245241]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#e4e1d8] bg-white px-4 text-[13px] font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-[#fcfbf8]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
