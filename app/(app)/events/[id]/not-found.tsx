import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/ui";
import { CalendarIcon, UsersIcon } from "@/components/icons";

export default function EventNotFound() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#e8e6de] bg-white px-6 py-14 text-center shadow-sm shadow-zinc-900/[0.025] sm:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#fdf0e4] blur-3xl"
      />

      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#193b30] text-orange-200 shadow-sm">
        <UsersIcon className="h-6 w-6" />
      </span>

      <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c96532]">
        Event not available
      </p>
      <h1 className="relative mt-2 text-[23px] font-semibold leading-tight tracking-tight text-[#18231d]">
        You don&apos;t have access to this event
      </h1>
      <p className="relative mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-zinc-500">
        Events are private to the people invited to them. If someone sent you a
        link, ask the owner to invite your email address from the event&apos;s
        Members tab — then open the invitation email they receive.
      </p>

      <div className="relative mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
        <Link href="/my-events" className={primaryButton}>
          <CalendarIcon className="h-4 w-4" />
          Go to my events
        </Link>
        <Link href="/dashboard" className={secondaryButton}>
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
