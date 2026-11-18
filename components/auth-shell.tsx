import type { ReactNode } from "react";
import { CalendarIcon, CheckCircleSolidIcon } from "./icons";

const highlights = [
  "One dashboard for every event you run",
  "Calendar and saved events",
  "Registrations and activity in real time",
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 right-[8%] h-[380px] w-[380px] rounded-full bg-indigo-200/40 blur-[110px]" />
        <div className="absolute -bottom-32 right-[28%] h-[360px] w-[360px] rounded-full bg-fuchsia-200/30 blur-[120px]" />
      </div>

      <section className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-nav p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/20">
            <CalendarIcon className="h-5 w-5" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-white">
            EventPulse
          </span>
        </div>

        <div className="relative">
          <h2 className="max-w-[380px] text-[36px] font-semibold leading-[1.12] tracking-tight">
            Every event, in one steady pulse.
          </h2>
          <p className="mt-4 max-w-[340px] text-[13.5px] leading-relaxed text-slate-400">
            Plan, publish and keep track of your events from a single workspace
            built for small teams.
          </p>

          <ul className="mt-8 space-y-3 text-[13px] text-slate-300">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircleSolidIcon className="h-4 w-4 shrink-0 text-indigo-400" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-950/30">
                <span className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/80">
                  Dec
                </span>
                <span className="text-[16px] font-semibold leading-none">
                  09
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  Product launch night
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                  6:00 PM · The Grand Hall
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                Upcoming
              </span>
            </div>
          </div>
        </div>

        <p className="relative text-[11.5px] text-slate-500">
          EventPulse — event manager
        </p>
      </section>

      <section className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px] rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.4)] ring-1 ring-zinc-200/60 backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </section>
    </main>
  );
}
