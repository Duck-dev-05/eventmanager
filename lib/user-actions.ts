"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session-cookie";
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminSetWorkspaceRole,
  adminUpdateUser,
  isWorkspaceAdmin,
} from "@/lib/users";

export type UserActionResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

const ADMIN_ONLY = "Only workspace admins can manage users.";

async function requireWorkspaceAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { user: null, error: "Authentication required." };
  }

  if (!(await isWorkspaceAdmin(sessionUser.id))) {
    return { user: null, error: ADMIN_ONLY };
  }

  return { user: sessionUser, error: null };
}

export async function createUserAction(
  prevState: UserActionResponse | null,
  formData: FormData,
): Promise<UserActionResponse> {
  const { user, error } = await requireWorkspaceAdmin();
  if (!user) return { success: false, error: error ?? ADMIN_ONLY };

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!name) {
    return { success: false, error: "Please enter a user name." };
  }
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (password && password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  const result = await adminCreateUser({
    name,
    email,
    password: password || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
  return { success: true, message: `User “${name}” created successfully.` };
}

export async function updateUserAction(
  prevState: UserActionResponse | null,
  formData: FormData,
): Promise<UserActionResponse> {
  const { user, error } = await requireWorkspaceAdmin();
  if (!user) return { success: false, error: error ?? ADMIN_ONLY };

  const userId = String(formData.get("userId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const workspaceRole = String(formData.get("workspaceRole") || "").trim();

  if (!userId) {
    return { success: false, error: "User ID missing." };
  }
  if (!name) {
    return { success: false, error: "Please enter a name." };
  }
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const result = await adminUpdateUser({ userId, name, email });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // A workspace role is optional: the field only exists for owners.
  if (workspaceRole) {
    const roleResult = await adminSetWorkspaceRole({
      userId,
      role: workspaceRole,
      actorId: user.id,
    });

    if (!roleResult.success) {
      revalidatePath("/users");
      return { success: false, error: roleResult.error };
    }
  }

  revalidatePath("/users");
  return { success: true, message: "User profile updated successfully." };
}

export async function setWorkspaceRoleAction(
  prevState: UserActionResponse | null,
  formData: FormData,
): Promise<UserActionResponse> {
  const { user, error } = await requireWorkspaceAdmin();
  if (!user) return { success: false, error: error ?? ADMIN_ONLY };

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("workspaceRole") || "").trim();

  if (!userId) {
    return { success: false, error: "User ID missing." };
  }

  const result = await adminSetWorkspaceRole({
    userId,
    role,
    actorId: user.id,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/users");
  return { success: true, message: "Workspace role updated." };
}

export async function resetPasswordAction(
  prevState: UserActionResponse | null,
  formData: FormData,
): Promise<UserActionResponse> {
  const { user, error } = await requireWorkspaceAdmin();
  if (!user) return { success: false, error: error ?? ADMIN_ONLY };

  const userId = String(formData.get("userId") || "");
  const newPassword = String(formData.get("newPassword") || "").trim();

  if (!userId) {
    return { success: false, error: "User ID missing." };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }

  const result = await adminResetPassword({ userId, newPassword });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/users");
  return { success: true, message: "User password reset successfully." };
}

export async function deleteUserAction(
  prevState: UserActionResponse | null,
  formData: FormData,
): Promise<UserActionResponse> {
  const { user, error } = await requireWorkspaceAdmin();
  if (!user) return { success: false, error: error ?? ADMIN_ONLY };

  const userId = String(formData.get("userId") || "");
  if (!userId) {
    return { success: false, error: "User ID missing." };
  }

  const result = await adminDeleteUser({
    userId,
    currentAdminId: user.id,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
  return { success: true, message: "User account deleted." };
}
