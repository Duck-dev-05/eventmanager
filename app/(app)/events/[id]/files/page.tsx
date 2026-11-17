import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { EventFilesClient } from "@/components/event-files-client";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import { findEventForUser, getEventRole } from "@/lib/events";
import { getEventFiles } from "@/lib/files";
import { rolePermissions } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";

async function Files({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const event = await findEventForUser(id, user.id);
  if (!event) notFound();

  const role = await getEventRole(id, user.id);
  if (!role) notFound();

  const permissions = rolePermissions(role);
  const files = await getEventFiles(id);

  return (
    <EventFilesClient
      eventId={id}
      files={files}
      canUpload={permissions.canManageFiles}
      canDelete={permissions.canDelete}
    />
  );
}

export default function EventFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EventTabSkeleton />}>
      {params.then(({ id }) => (
        <Files id={id} />
      ))}
    </Suspense>
  );
}
