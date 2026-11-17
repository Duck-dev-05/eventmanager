import type { ReactNode } from "react";

const tones = {
  indigo: "bg-accent-soft text-accent ring-accent-line",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
} as const;

export function StatCard({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
  tone: keyof typeof tones;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{caption}</p>
    </div>
  );
}
