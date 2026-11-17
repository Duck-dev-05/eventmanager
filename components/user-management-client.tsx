"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  updateUserAction,
  type UserActionResponse,
} from "@/lib/user-actions";
import type { UserWithStats } from "@/lib/users";
import { Avatar } from "./avatar";
import {
  GoogleIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from "./icons";

const AVATAR_GRADIENTS = [
  "from-[#193b30] to-[#2d5c47]", // forest
  "from-[#1e3a5f] to-[#2d5c8c]", // ocean
  "from-[#4a1942] to-[#7b2d6e]", // plum
  "from-[#5c2d1e] to-[#8c4a30]", // amber
  "from-[#1a3a5c] to-[#2a5c82]", // slate
  "from-[#2d3a1e] to-[#4e6b35]", // olive
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function UserManagementClient({
  users,
  currentUserId,
  canManageRoles = false,
}: {
  users: UserWithStats[];
  currentUserId: string;
  /** Only workspace owners may promote or demote other accounts. */
  canManageRoles?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithStats | null>(null);
  const [resetUser, setResetUser] = useState<UserWithStats | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserWithStats | null>(null);

  // Form states with useActionState
  const [createState, createAction, isCreating] = useActionState<
    UserActionResponse | null,
    FormData
  >(async (prev, formData) => {
    const res = await createUserAction(prev, formData);
    if (res.success) {
      setCreateModalOpen(false);
    }
    return res;
  }, null);

  const [editState, editAction, isEditing] = useActionState<
    UserActionResponse | null,
    FormData
  >(async (prev, formData) => {
    const res = await updateUserAction(prev, formData);
    if (res.success) {
      setEditUser(null);
    }
    return res;
  }, null);

  const [resetState, resetAction, isResetting] = useActionState<
    UserActionResponse | null,
    FormData
  >(async (prev, formData) => {
    const res = await resetPasswordAction(prev, formData);
    if (res.success) {
      setResetUser(null);
    }
    return res;
  }, null);

  const [deleteState, deleteAction, isDeleting] = useActionState<
    UserActionResponse | null,
    FormData
  >(async (prev, formData) => {
    const res = await deleteUserAction(prev, formData);
    if (res.success) {
      setDeleteTarget(null);
    }
    return res;
  }, null);

  const filteredUsers = users.filter((u) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  const totalOrganizers = users.filter((u) => u.ownedEventsCount > 0).length;
  const totalGoogle = users.filter((u) => u.provider === "google").length;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">
              Total registered users
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <UsersIcon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-[28px] font-bold tracking-tight text-ink">
            {users.length}
          </p>
          <p className="mt-1 text-[11.5px] text-faint">
            Across all workspace teams and events
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">
              Event organizers & hosts
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldIcon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-[28px] font-bold tracking-tight text-ink">
            {totalOrganizers}
          </p>
          <p className="mt-1 text-[11.5px] text-faint">
            Created at least 1 active or upcoming event
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">
              Google SSO accounts
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <GoogleIcon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-[28px] font-bold tracking-tight text-ink">
            {totalGoogle}
          </p>
          <p className="mt-1 text-[11.5px] text-faint">
            {users.length - totalGoogle} standard email & password
          </p>
        </div>
      </div>

      {/* Control bar: Search + Create user */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="h-10 w-full rounded-xl border border-line bg-panel pl-9.5 pr-4 text-[13px] text-ink shadow-xs placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-nav focus:outline-none focus:ring-2 focus:ring-ink/25"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add user</span>
        </button>
      </div>

      {/* Global feedback messages */}
      {createState?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
          {createState.error}
        </div>
      )}
      {deleteState?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
          {deleteState.error}
        </div>
      )}
      {createState?.message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          {createState.message}
        </div>
      )}
      {deleteState?.message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          {deleteState.message}
        </div>
      )}
      {resetState?.message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          {resetState.message}
        </div>
      )}

      {/* Users Table / List */}
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-sunken/40 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Authentication</th>
                <th className="px-5 py-3.5">Events Activity</th>
                <th className="px-5 py-3.5">Registered</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted">
                    No users found matching &ldquo;{search}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;
                  const initials = user.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-sunken/30"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={user.avatarUrl}
                            initials={initials || "U"}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">
                                {user.name}
                              </span>
                              {isCurrent && (
                                <span className="rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                                  You
                                </span>
                              )}
                              {user.workspaceRole !== "member" ? (
                                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                  {user.workspaceRole === "owner"
                                    ? "Workspace owner"
                                    : "Workspace admin"}
                                </span>
                              ) : null}
                            </div>
                            <span className="block truncate text-[12px] text-faint">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="px-5 py-4">
                        {user.provider === "google" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11.5px] font-medium text-zinc-700">
                            <GoogleIcon className="h-3.5 w-3.5" />
                            Google SSO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11.5px] font-medium text-zinc-700">
                            <MailIcon className="h-3.5 w-3.5 text-zinc-500" />
                            Email & Password
                          </span>
                        )}
                      </td>

                      {/* Events Activity */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            title="Events created by this user"
                            className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800"
                          >
                            {user.ownedEventsCount} owned
                          </span>
                          <span
                            title="Events joined as team member"
                            className="inline-flex items-center rounded-md border border-indigo-200/80 bg-indigo-50 px-2 py-0.5 text-[11.5px] font-medium text-indigo-800"
                          >
                            {user.joinedEventsCount} joined
                          </span>
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="px-5 py-4 text-[12.5px] text-muted">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditUser(user)}
                            title="Edit user details"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:bg-sunken hover:text-ink focus:outline-none"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setResetUser(user)}
                            title="Reset password"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:bg-sunken hover:text-ink focus:outline-none"
                          >
                            <ShieldIcon className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => setDeleteTarget(user)}
                            title={
                              isCurrent
                                ? "Cannot delete your own account"
                                : "Delete user"
                            }
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus:outline-none ${
                              isCurrent
                                ? "cursor-not-allowed border-transparent text-zinc-300"
                                : "border-rose-200/60 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            }`}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-zinc-900">
                Create new user
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-faint hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-zinc-500">
              Add a new team member or event organizer directly to the
              workspace.
            </p>

            <form action={createAction} className="mt-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  Full name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. John Doe"
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  Email address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="user@example.com"
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  Initial password
                </label>
                <input
                  type="text"
                  name="password"
                  defaultValue="EventPulse123!"
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
                <span className="mt-1 block text-[11px] text-zinc-400">
                  Minimum 6 characters. The user can change this later in their
                  settings.
                </span>
              </div>

              {createState?.error && (
                <p className="text-[12px] font-medium text-rose-600">
                  {createState.error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center justify-center rounded-xl bg-[#193b30] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#245241] disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-zinc-900">
                Edit user profile
              </h3>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="rounded-lg p-1 text-faint hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form action={editAction} className="mt-5 space-y-4">
              <input type="hidden" name="userId" value={editUser.id} />

              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  Full name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editUser.name}
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  Email address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={editUser.email}
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
              </div>

              {canManageRoles ? (
                <div>
                  <label className="block text-[12px] font-semibold text-zinc-700">
                    Workspace role
                  </label>
                  <select
                    name="workspaceRole"
                    defaultValue={editUser.workspaceRole}
                    className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                  >
                    <option value="owner">Owner — full workspace control</option>
                    <option value="admin">Admin — manage users and events</option>
                    <option value="member">Member — own events only</option>
                  </select>
                  <span className="mt-1 block text-[11px] text-zinc-400">
                    Only owners can hand out roles, and the workspace always
                    keeps at least one owner.
                  </span>
                </div>
              ) : null}

              {editState?.error && (
                <p className="text-[12px] font-medium text-rose-600">
                  {editState.error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="inline-flex items-center justify-center rounded-xl bg-[#193b30] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#245241] disabled:opacity-50"
                >
                  {isEditing ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-zinc-900">
                Reset user password
              </h3>
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="rounded-lg p-1 text-faint hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-zinc-500">
              Set a new login password for <strong>{resetUser.name}</strong> (
              {resetUser.email}).
            </p>

            <form action={resetAction} className="mt-5 space-y-4">
              <input type="hidden" name="userId" value={resetUser.id} />

              <div>
                <label className="block text-[12px] font-semibold text-zinc-700">
                  New password
                </label>
                <input
                  type="text"
                  name="newPassword"
                  required
                  placeholder="Enter at least 6 characters"
                  className="mt-1.5 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-[13px] text-zinc-900 shadow-xs focus:border-[#193b30] focus:outline-none focus:ring-2 focus:ring-[#193b30]/15"
                />
              </div>

              {resetState?.error && (
                <p className="text-[12px] font-medium text-rose-600">
                  {resetState.error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="inline-flex items-center justify-center rounded-xl bg-[#193b30] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#245241] disabled:opacity-50"
                >
                  {isResetting ? "Updating..." : "Set new password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <h3 className="text-[17px] font-semibold text-rose-900">
              Delete user account?
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
              Are you sure you want to permanently delete{" "}
              <strong className="text-zinc-900">{deleteTarget.name}</strong> (
              {deleteTarget.email})?
            </p>
            {deleteTarget.ownedEventsCount > 0 && (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
                Warning: This user owns {deleteTarget.ownedEventsCount} event(s).
                Deleting this account will permanently delete those events,
                schedules, tasks, and files.
              </p>
            )}

            <form action={deleteAction} className="mt-6">
              <input type="hidden" name="userId" value={deleteTarget.id} />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
