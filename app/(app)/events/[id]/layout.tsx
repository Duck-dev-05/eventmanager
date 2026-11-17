import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { EventHeader, EventHeaderSkeleton } from "@/components/event-header";
import { EventTabs, EventTabsSkeleton } from "@/components/event-tabs";
import { findEventForUser, getEventRole } from "@/lib/events";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

async function EventTabsSection({ id }: { id: string }) {
  await connection();
  const user = await getSessionUser();
  const event = user ? await findEventForUser(id, user.id) : null;
  const role = user && event ? await getEventRole(id, user.id) : null;
  const isMember = Boolean(role && role !== "owner");

  return (
    <>
      <EventTabs id={id} role={role} />

      {isMember && role ? (
        <p className="rounded-xl border border-[#e5ddcf] bg-[#fffaf2] px-4 py-3 text-[12.5px] text-[#76532c]">
          You&apos;re viewing this event as {ROLE_LABELS[role].toLowerCase()}.{" "}
          {ROLE_DESCRIPTIONS[role]}
        </p>
      ) : null}
    </>
  );
}

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4 sm:space-y-5">
      <Suspense fallback={<EventHeaderSkeleton />}>
        <EventHeader id={id} />
      </Suspense>

      <Suspense fallback={<EventTabsSkeleton />}>
        <EventTabsSection id={id} />
      </Suspense>

      {children}
    </div>
  );
}
