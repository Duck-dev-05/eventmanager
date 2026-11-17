import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/activity";
import { getSessionUser } from "@/lib/session-cookie";
import { deleteEventFile, readEventFile } from "@/lib/files";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download files." }, { status: 401 });
  }

  const result = await readEventFile({ eventId: id, fileId, userId: user.id });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(result.body, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.body.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${result.name.replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(result.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to delete files." }, { status: 401 });
  }

  const result = await deleteEventFile({
    eventId: id,
    fileId,
    actorId: user.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logEventActivity({
    eventId: id,
    actorId: user.id,
    kind: "file",
    summary: `deleted ${result.name}`,
  });

  revalidatePath(`/events/${id}/files`);
  return NextResponse.json({ ok: true });
}
