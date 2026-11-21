import { NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync";
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminSetWorkspaceRole,
  adminUpdateUser,
  findUserById,
  isWorkspaceAdmin,
  isWorkspaceOwner,
  listAllUsersWithStats,
} from "@/lib/users";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  if (!(await isWorkspaceAdmin(device.userId))) {
    return NextResponse.json({ error: "Only workspace administrators can manage users." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (action === "list") return NextResponse.json({ users: await listAllUsersWithStats() });

  if (action === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    const result = await adminCreateUser({ name, email, password });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (!userId) return NextResponse.json({ error: "Choose a user." }, { status: 400 });

  if (action === "update") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const result = await adminUpdateUser({ userId, name, email });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "set-role") {
    const role = typeof body.role === "string" ? body.role : "";
    const result = await adminSetWorkspaceRole({ userId, role, actorId: device.userId });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "reset-password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    const result = await adminResetPassword({ userId, newPassword: password });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const target = await findUserById(userId);
    if (!target) return NextResponse.json({ error: "That user no longer exists." }, { status: 404 });
    if (target.workspaceRole === "owner" && !(await isWorkspaceOwner(device.userId))) {
      return NextResponse.json({ error: "Only the workspace owner can delete an owner account." }, { status: 403 });
    }
    const result = await adminDeleteUser({ userId, currentAdminId: device.userId });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Choose a valid user action." }, { status: 400 });
}
