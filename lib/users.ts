import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { resolveAvatarUrl } from "./avatar.ts";
import { getDb } from "./db.ts";

/** Workspace-wide access. Event roles live in roles.ts and are unrelated. */
export type WorkspaceRole = "owner" | "admin" | "member";

export function normalizeWorkspaceRole(
  value: string | null | undefined,
): WorkspaceRole {
  return value === "owner" || value === "admin" ? value : "member";
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "member";
}

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  provider?: "password" | "google";
  passwordHash?: string;
  googleSub?: string;
  avatarUrl?: string;
  /** Last photo Google reported, kept so people can switch back to it. */
  googleAvatarUrl?: string;
  workspaceRole: WorkspaceRole;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  provider: string;
  password_hash: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
  workspace_role: string;
  created_at: string;
};

const columns =
  "id, name, email, provider, password_hash, google_sub, avatar_url, google_avatar_url, workspace_role, created_at";

function toStoredUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    provider: row.provider === "google" ? "google" : "password",
    passwordHash: row.password_hash ?? undefined,
    googleSub: row.google_sub ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    googleAvatarUrl: row.google_avatar_url ?? undefined,
    workspaceRole: normalizeWorkspaceRole(row.workspace_role),
  };
}

/** The first account in a fresh install administers the workspace. */
async function nextWorkspaceRole(): Promise<WorkspaceRole> {
  const row = (await (await getDb()).prepare("SELECT COUNT(*) AS count FROM users").get()) as
    | { count: number }
    | undefined;

  return (row?.count ?? 0) === 0 ? "owner" : "member";
}

export async function isWorkspaceAdmin(userId: string) {
  const row = await (await getDb())
    .prepare("SELECT workspace_role FROM users WHERE id = ?")
    .get(userId) as { workspace_role: string } | undefined;

  const role = normalizeWorkspaceRole(row?.workspace_role);
  return role === "owner" || role === "admin";
}

export async function isWorkspaceOwner(userId: string) {
  const row = await (await getDb())
    .prepare("SELECT workspace_role FROM users WHERE id = ?")
    .get(userId) as { workspace_role: string } | undefined;

  return normalizeWorkspaceRole(row?.workspace_role) === "owner";
}

async function workspaceOwnerCount() {
  const row = await (await getDb())
    .prepare("SELECT COUNT(*) AS count FROM users WHERE workspace_role = 'owner'")
    .get() as { count: number } | undefined;

  return row?.count ?? 0;
}

/** Only an owner may hand out workspace roles, and the last owner stays. */
export async function adminSetWorkspaceRole({
  userId,
  role,
  actorId,
}: {
  userId: string;
  role: string;
  actorId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isWorkspaceRole(role)) {
    return { success: false, error: "That workspace role does not exist." };
  }

  if (!(await isWorkspaceOwner(actorId))) {
    return {
      success: false,
      error: "Only the workspace owner can change workspace roles.",
    };
  }

  if (userId === actorId && role !== "owner") {
    return {
      success: false,
      error: "You cannot change your own workspace role.",
    };
  }

  const target = await findUserById(userId);
  if (!target) {
    return { success: false, error: "That user no longer exists." };
  }

  if (target.workspaceRole === "owner" && role !== "owner" && (await workspaceOwnerCount()) <= 1) {
    return {
      success: false,
      error: "The workspace needs at least one owner.",
    };
  }

  await (await getDb())
    .prepare("UPDATE users SET workspace_role = ? WHERE id = ?")
    .run(role, userId);

  return { success: true };
}

export async function findUserByEmail(email: string) {
  const row = await (await getDb())
    .prepare(`SELECT ${columns} FROM users WHERE email = ?`)
    .get(email.toLowerCase()) as UserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export async function findUserById(id: string) {
  const row = await (await getDb())
    .prepare(`SELECT ${columns} FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export async function updateUserName(id: string, name: string) {
  await (await getDb()).prepare(`UPDATE users SET name = ? WHERE id = ?`).run(name, id);
}

export async function updateUserAvatarUrl(id: string, avatarUrl: string | null) {
  await (await getDb())
    .prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`)
    .run(avatarUrl, id);
}

export async function updateUserPassword(id: string, password: string) {
  const result = await (await getDb())
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .run(hashPassword(password), id);

  return result.changes > 0;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export async function createUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const user: StoredUser = {
    id: randomUUID(),
    name,
    email: email.toLowerCase(),
    provider: "password",
    passwordHash: hashPassword(password),
    workspaceRole: await nextWorkspaceRole(),
    createdAt: new Date().toISOString(),
  };

  await (await getDb())
    .prepare(
      `INSERT INTO users
         (id, name, email, provider, password_hash, workspace_role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.name,
      user.email,
      "password",
      user.passwordHash ?? null,
      user.workspaceRole,
      user.createdAt,
    );

  return user;
}

export async function upsertGoogleUser({
  sub,
  email,
  name,
  picture,
}: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}) {
  const db = await getDb();
  const normalized = email.toLowerCase();
  const existing = await findUserByEmail(normalized);
  // Google refreshes the photo URL on every sign-in; storing it here keeps the
  // avatar current for people who opened their account before Google login.
  const avatarUrl = resolveAvatarUrl(picture);

  if (existing) {
    // A freshly uploaded photo outranks the Google one; anything else follows
    // whatever Google currently reports.
    db.prepare(
      `UPDATE users
       SET google_sub = COALESCE(google_sub, ?),
           google_avatar_url = COALESCE(?, google_avatar_url),
           avatar_url = CASE
             WHEN avatar_url IS NULL OR avatar_url LIKE '%googleusercontent.com%'
             THEN COALESCE(?, avatar_url)
             ELSE avatar_url
           END
       WHERE id = ?`,
    ).run(sub, avatarUrl ?? null, avatarUrl ?? null, existing.id);

    return (await findUserByEmail(normalized)) ?? existing;
  }

  const user: StoredUser = {
    id: randomUUID(),
    name: name?.trim() || normalized.split("@")[0],
    email: normalized,
    provider: "google",
    googleSub: sub,
    avatarUrl,
    googleAvatarUrl: avatarUrl,
    workspaceRole: await nextWorkspaceRole(),
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO users
       (id, name, email, provider, google_sub, avatar_url, google_avatar_url, workspace_role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.name,
    user.email,
    "google",
    sub,
    avatarUrl ?? null,
    avatarUrl ?? null,
    user.workspaceRole,
    user.createdAt,
  );

  return user;
}

export function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) return false;

  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, expected.length);

  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

export type UserWithStats = {
  id: string;
  name: string;
  email: string;
  provider: "password" | "google";
  workspaceRole: WorkspaceRole;
  avatarUrl?: string;
  createdAt: string;
  ownedEventsCount: number;
  joinedEventsCount: number;
};

export async function listAllUsersWithStats(): Promise<UserWithStats[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.provider, 
        u.avatar_url, 
        u.workspace_role,
        u.created_at,
        (SELECT COUNT(*) FROM events e WHERE e.owner_id = u.id) AS owned_events_count,
        (SELECT COUNT(*) FROM event_members em WHERE em.user_id = u.id AND em.status = 'accepted') AS joined_events_count
      FROM users u
      ORDER BY u.created_at DESC`,
    )
    .all() as Array<{
      id: string;
      name: string;
      email: string;
      provider: string;
      avatar_url: string | null;
      workspace_role: string;
      created_at: string;
      owned_events_count: number | bigint;
      joined_events_count: number | bigint;
    }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider === "google" ? "google" : "password",
    workspaceRole: normalizeWorkspaceRole(row.workspace_role),
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    ownedEventsCount: Number(row.owned_events_count || 0),
    joinedEventsCount: Number(row.joined_events_count || 0),
  }));
}

export async function adminCreateUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password?: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      error: "A user with this email address already exists.",
    };
  }

  const pwd = password?.trim() || "EventPulse123!";
  const user = await createUser({
    name: name.trim(),
    email: normalizedEmail,
    password: pwd,
  });

  return { success: true, user };
}

export async function adminUpdateUser({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
    .get(normalizedEmail, userId) as { id: string } | undefined;

  if (existing) {
    return {
      success: false,
      error: "Another user is already using this email address.",
    };
  }

  db.prepare(`UPDATE users SET name = ?, email = ? WHERE id = ?`).run(
    name.trim(),
    normalizedEmail,
    userId,
  );

  return { success: true };
}

export async function adminResetPassword({
  userId,
  newPassword,
}: {
  userId: string;
  newPassword: string;
}) {
  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters long.",
    };
  }

  const db = await getDb();
  const passwordHash = hashPassword(newPassword);
  db.prepare(
    `UPDATE users SET password_hash = ?, provider = 'password' WHERE id = ?`,
  ).run(passwordHash, userId);

  return { success: true };
}

export async function adminDeleteUser({
  userId,
  currentAdminId,
}: {
  userId: string;
  currentAdminId: string;
}) {
  if (userId === currentAdminId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  const target = await findUserById(userId);
  if (!target) {
    return { success: false, error: "That user no longer exists." };
  }
  if (target.workspaceRole === "owner" && (await workspaceOwnerCount()) <= 1) {
    return {
      success: false,
      error: "The workspace needs at least one owner.",
    };
  }

  const db = await getDb();
  const txn = await db.transaction();
  try {
    await txn.prepare("DELETE FROM users WHERE id = ?").run(userId);
    await txn.commit();
    return { success: true };
  } catch {
    await txn.rollback().catch(() => {});
    return { success: false, error: "Failed to delete user." };
  }
}
