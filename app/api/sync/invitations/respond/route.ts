import { NextResponse } from "next/server";
import { authenticateSyncRequest, respondToDeviceInvitation } from "@/lib/sync";

export async function POST(request: Request) {
  const device = await authenticateSyncRequest(request);
  if (!device) {
    return NextResponse.json({ error: "Invalid sync token. Re-pair the desktop app." }, { status: 401 });
  }

  let body: { invitationId?: unknown; response?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const invitationId = typeof body.invitationId === "string" ? body.invitationId.trim() : "";
  const response = body.response;
  if (!invitationId || (response !== "accept" && response !== "decline")) {
    return NextResponse.json({ error: "A valid invitation and response are required." }, { status: 400 });
  }

  const result = await respondToDeviceInvitation(device, invitationId, response);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
