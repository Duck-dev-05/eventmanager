import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-sunken/40 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-line bg-panel text-accent shadow-panel">
        {icon}
      </span>
      <h3 className="relative mt-4 text-[15px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="relative mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  );
}
