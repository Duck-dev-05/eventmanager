"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas text-ink">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a4c20]">
              EventPulse
            </p>
            <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-[#18231d]">
              Something went wrong
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
              The app hit an unexpected error before the page could render.
              Reloading usually clears it.
            </p>
            <button
              type="button"
              onClick={() => retry()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#193b30] px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#245241]"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
