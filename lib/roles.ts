/** Roles an event team can have. `owner` comes from events.owner_id, not this row. */
export type EventRole = "owner" | "admin" | "member" | "viewer";

/** Roles the event owner can hand out to members. */
export const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<EventRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<EventRole, string> = {
  owner: "Full control, including roles, invitations and settings.",
  admin: "Can invite people, edit tasks and delete work.",
  member: "Can create and edit tasks, but cannot delete anything.",
  viewer: "Read-only access. Can see everything and change nothing.",
};

/** Second-person summary used on the invitation landing page. */
export const ROLE_SUMMARIES: Record<EventRole, string> = {
  owner: "you control the event, its team and its settings",
  admin: "you can invite people, edit tasks and delete work",
  member: "you can create and edit tasks, but not delete anything",
  viewer: "you can view the event without changing anything",
};

export function isAssignableRole(value: unknown): value is AssignableRole {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_ROLES as readonly string[]).includes(value)
  );
}

export function normalizeRole(value: string | null | undefined): EventRole {
  return value === "owner" || value === "admin" || value === "viewer"
    ? value
    : "member";
}

export function rolePermissions(role: EventRole) {
  const manager = role === "owner" || role === "admin";

  return {
    /** Invite, remove and cancel invitations. */
    canManageTeam: manager,
    /** Every role with access can open and download shared files. */
    canViewFiles: true,
    /** Upload files. */
    canManageFiles: manager,
    /** Create and update work items such as tasks. */
    canEdit: role !== "viewer",
    /** Delete work items and remove people. */
    canDelete: manager,
    /** Assign or change another member's role. */
    canChangeRoles: role === "owner",
    /** Remove themselves from the event. */
    canLeave: role !== "owner",
    /** Nothing they open can be changed. */
    readOnly: role === "viewer",
  };
}
