import Link from "next/link";
import { CalendarIcon } from "@/components/icons";

export const metadata = {
  title: "Page not found — EventPulse",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/3 h-[360px] w-[360px] rounded-full bg-orange-100/60 blur-[110px]" />
        <div className="absolute bottom-0 right-1/4 h-[320px] w-[320px] rounded-full bg-emerald-100/50 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200/70 bg-white p-8 text-center shadow-sm shadow-zinc-900/[0.02]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 text-white shadow-lg shadow-orange-900/10">
          <CalendarIcon className="h-6 w-6" />
        </span>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a4c20]">
          404 — Not found
        </p>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-[#18231d]">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500">
          The link may be broken, or the event may have been deleted or moved.
          Try your workspace instead.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#193b30] px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#245241]"
          >
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#e4e1d8] bg-white px-4 text-[13px] font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-[#fcfbf8]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
