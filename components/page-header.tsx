import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted shadow-panel">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </span>
        <h1 className="mt-3 text-[29px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
