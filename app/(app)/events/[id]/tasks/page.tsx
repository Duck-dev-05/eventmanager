import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import { EventTaskList } from "@/components/event-task-list";
import { StatCard } from "@/components/stat-card";
import { CheckCircleSolidIcon, ClockIcon, UsersIcon } from "@/components/icons";
import { findEventForUser, getEventMembers, getEventRole } from "@/lib/events";
import { rolePermissions } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";
import { getEventTasks, summarizeTasks } from "@/lib/tasks";
import { findUserById } from "@/lib/users";

async function Tasks({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const role = await getEventRole(id, user.id);
  if (!role) notFound();

  const permissions = rolePermissions(role);

  const [tasks, members, owner] = await Promise.all([
    getEventTasks(id),
    getEventMembers(id),
    findUserById(event.ownerId),
  ]);

  const summary = summarizeTasks(tasks);

  const team = [
    ...(owner ? [{ id: owner.id, name: `${owner.name} (owner)` }] : []),
    ...members
      .filter((member) => member.id !== owner?.id)
      .map((member) => ({ id: member.id, name: member.name })),
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open tasks"
          value={String(summary.open)}
          caption={
            summary.done === 0 ? "Nothing completed yet" : `${summary.done} done`
          }
          tone="indigo"
          icon={<CheckCircleSolidIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Due this week"
          value={String(summary.dueThisWeek)}
          caption={
            summary.dueThisWeek === 0
              ? "No deadlines coming up"
              : "Within the next 7 days"
          }
          tone="amber"
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Assigned"
          value={String(summary.assigned)}
          caption={
            summary.assigned === 0
              ? "No teammates assigned"
              : summary.assigned === 1
                ? "1 teammate with work"
                : `${summary.assigned} teammates with work`
          }
          tone="emerald"
          icon={<UsersIcon className="h-4 w-4" />}
        />
      </section>

      <EventTaskList
        eventId={id}
        tasks={tasks}
        team={team}
        canEdit={permissions.canEdit}
        canDelete={permissions.canDelete}
      />
    </div>
  );
}

export default function EventTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EventTabSkeleton />}>
      {params.then(({ id }) => (
        <Tasks id={id} />
      ))}
    </Suspense>
  );
}
