import { NextResponse } from "next/server";
import { createWebBackup } from "@/lib/backup";
import { getSessionUser } from "@/lib/session-cookie";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage backups." }, { status: 401 });
  if (user.workspaceRole !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can create or restore full backups." }, { status: 403 });
  }

  try {
    const backup = await createWebBackup();
    return new NextResponse(JSON.stringify(backup), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="eventpulse-web-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Backup export failed:", error);
    return NextResponse.json({ error: "The workspace backup could not be created." }, { status: 500 });
  }
}
