import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrimaryLink } from "@/components/ui";
import { BellIcon, CalendarDotsIcon, ClockIcon, MapPinIcon, UsersIcon } from "@/components/icons";
import { listNotificationsForUser } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session-cookie";
import { NotificationsClient } from "@/components/notifications-client";

type Tone = "indigo" | "emerald" | "amber";

async function NotificationsContent() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await listNotificationsForUser(user.id, 20);
  const soonNotifications = notifications.filter(n => n.kind === "event_upcoming");
  const sharedNotifications = notifications.filter(n => n.kind === "event_shared");
  const attentionNotifications = notifications.filter(n => n.kind === "event_needs_venue");

  const groups = [
    {
      title: "Coming up",
      hint: "Events starting in the next week.",
      tone: "indigo" as Tone,
      Icon: ClockIcon,
      items: soonNotifications.map(n => ({
        id: n.id,
        title: n.title,
        description: n.message,
        meta: n.linkUrl ? `Ends ${new Date(n.createdAt).toLocaleString()}` : "",
        href: n.linkUrl || "/",
      })),
    },
    {
      title: "Shared with you",
      hint: "Events shared with you by others.",
      tone: "emerald" as Tone,
      Icon: UsersIcon,
      items: sharedNotifications.map(n => ({
        id: n.id,
        title: n.title,
        description: n.message,
        meta: n.linkUrl ? `Shared ${new Date(n.createdAt).toLocaleString()}` : "",
        href: n.linkUrl || "/",
      })),
    },
    {
      title: "Needs attention",
      hint: "Events missing a venue or other details.",
      tone: "amber" as Tone,
      Icon: MapPinIcon,
      items: attentionNotifications.map(n => ({
        id: n.id,
        title: n.title,
        description: n.message,
        meta: n.linkUrl ? `Updated ${new Date(n.createdAt).toLocaleString()}` : "",
        href: n.linkUrl || "/",
      })),
    },
  ].filter(g => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <section className="rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-2.5">
        <EmptyState
          icon={<BellIcon className="h-5 w-5" />}
          title="You're all caught up"
          description="Reminders, shared events and event nudges will show up here."
          action={
            <PrimaryLink href="/my-events">
              <CalendarDotsIcon className="h-4 w-4" />
              Browse my events
            </PrimaryLink>
          }
        />
      </section>
    );
  }

  return <NotificationsClient groups={groups} />;
}

export default function NotificationsPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="A single feed for reminders, shared events and details worth a second look."
        action={
          <Suspense fallback={<span className="grow h-11 rounded-xl bg-white/70" />}>
            <NotificationsBadge />
          </Suspense>
        }
      />

      <Suspense fallback={<div className="space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-[220px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
        ))}
      </div>}>
        <NotificationsContent />
      </Suspense>
    </div>
  );
}

function NotificationsBadge() {
  return (
    <div className="flex items-center justify-center">
      <NotificationsBadgeBadge />
    </div>
  );
}

function NotificationsBadgeBadge() {
  return (
    <div className="flex items-center gap-2">
      <BellIcon className="h-5 w-5 text-zinc-500" />
      <span className="text-[12.5px] text-zinc-500">Notifications</span>
    </div>
  );
}
