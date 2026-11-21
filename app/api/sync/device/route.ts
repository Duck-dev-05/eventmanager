import { NextResponse } from "next/server";
import { authenticateSyncRequest, deleteSyncDevice } from "@/lib/sync";

export async function DELETE(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json(
      { error: "Invalid sync token. Re-pair the Android app." },
      { status: 401 },
    );
  }

  await deleteSyncDevice(device.userId, device.id);
  return NextResponse.json({ success: true });
}
