import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  findEventForUser,
  getEventInvitations,
  getEventMembers,
  getEventRole,
} from "@/lib/events";
import { rolePermissions } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";
import { findUserById } from "@/lib/users";
import { EventMembersClient } from "@/components/event-members-client";

function MembersSkeleton() {
  return (
    <div className="h-[280px] animate-pulse rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]" />
  );
}

async function MembersServer({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const role = await getEventRole(id, user.id);
  if (!role) notFound();

  const { canManageTeam } = rolePermissions(role);
  const owner = (await findUserById(event.ownerId)) ?? {
    id: event.ownerId,
    name: "Event owner",
    email: "",
    avatarUrl: undefined,
  };
  const [members, invitations] = await Promise.all([
    getEventMembers(id),
    getEventInvitations(id),
  ]);

  return (
    <EventMembersClient
      role={role}
      owner={{
        id: owner.id,
        name: owner.name,
        email: owner.email,
        avatarUrl: owner.avatarUrl,
      }}
      currentUserId={user.id}
      members={members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        status: member.status,
        role: member.role,
        avatarUrl: member.avatarUrl ?? undefined,
      }))}
      invitations={
        canManageTeam
          ? invitations.map((invitation) => ({
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              name: invitation.name,
              avatarUrl: invitation.avatarUrl,
            }))
          : []
      }
      eventId={id}
    />
  );
}

export default function EventMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      {params.then(({ id }) => (
        <MembersServer id={id} />
      ))}
    </Suspense>
  );
}