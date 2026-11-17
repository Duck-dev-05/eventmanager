import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { UserManagementClient } from "@/components/user-management-client";
import { getSessionUser } from "@/lib/session-cookie";
import { isWorkspaceAdmin, listAllUsersWithStats } from "@/lib/users";

export const instant = false;

export const metadata = {
  title: "Users & Team — EventPulse",
  description: "Manage users, organizers, and access across the workspace.",
};

function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[120px] animate-pulse rounded-2xl border border-line bg-panel"
          />
        ))}
      </div>
      <div className="h-[400px] animate-pulse rounded-2xl border border-line bg-panel" />
    </div>
  );
}

async function UsersContent() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Account management is workspace-level: ordinary members never see it.
  if (!(await isWorkspaceAdmin(user.id))) redirect("/dashboard");

  const users = await listAllUsersWithStats();

  return (
    <UserManagementClient
      users={users}
      currentUserId={user.id}
      canManageRoles={user.workspaceRole === "owner"}
    />
  );
}

export default function UsersPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Users & Team"
        description="Create, manage and oversee user accounts across your EventPulse workspace."
      />

      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}
