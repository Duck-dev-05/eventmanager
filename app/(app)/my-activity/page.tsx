import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ActivityFeed, type ActivityItem } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { listActivityForUser } from "@/lib/events";
import { timeStamp } from "@/lib/event-format";
import { getSessionUser } from "@/lib/session-cookie";

function ActivitySkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-11 w-full animate-pulse rounded-xl bg-white/70 sm:w-[360px]" />
      <div className="space-y-2 rounded-3xl border border-zinc-200/70 bg-white p-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[66px] animate-pulse rounded-xl bg-zinc-100/80"
          />
        ))}
      </div>
    </div>
  );
}

async function Activity() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const entries = await listActivityForUser(user.id);

  const items: ActivityItem[] = entries.map((entry, index) => ({
    key: `${entry.kind}-${entry.eventId}-${index}`,
    kind: entry.kind,
    eventId: entry.eventId,
    title: entry.title,
    when: timeStamp.format(new Date(entry.at)),
  }));

  return <ActivityFeed items={items} />;
}

export default function MyActivityPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Insights"
        title="My Activity"
        description="A running log of the events you create and join across your workspace."
      />

      <Suspense fallback={<ActivitySkeleton />}>
        <Activity />
      </Suspense>
    </div>
  );
}
