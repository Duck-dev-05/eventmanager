import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-cookie";
import { getUnreadNotificationCount } from "@/lib/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to see notifications." }, { status: 401 });
  }

  const count = await getUnreadNotificationCount(user.id);
  return NextResponse.json({ count });
}
