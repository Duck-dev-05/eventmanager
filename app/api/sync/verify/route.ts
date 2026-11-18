import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authenticateSyncRequest } from "@/lib/sync";

/**
 * Used by the desktop app when pairing: verifies the token and returns the
 * paired account so the app can show what it is syncing with.
 */
export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json(
      { error: "Invalid sync token. Create a new one on the website Settings page." },
      { status: 401 },
    );
  }

  const row = (await (await getDb())
    .prepare("SELECT id, name, email FROM users WHERE id = ?")
    .get(device.userId)) as
    | { id: string; name: string; email: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Paired account no longer exists." }, { status: 401 });
  }

  return NextResponse.json({
    device: { id: device.id, name: device.name },
    user: { id: row.id, name: row.name, email: row.email },
  });
}
