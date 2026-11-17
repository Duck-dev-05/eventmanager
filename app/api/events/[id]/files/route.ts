import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/activity";
import { getSessionUser } from "@/lib/session-cookie";
import { MAX_FILE_BYTES } from "@/lib/file-types";
import { storeEventFile } from "@/lib/files";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "That upload could not be read. Try again." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Files must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const result = await storeEventFile({
    eventId: id,
    actorId: user.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logEventActivity({
    eventId: id,
    actorId: user.id,
    kind: "file",
    summary: `uploaded ${file.name}`,
  });

  revalidatePath(`/events/${id}/files`);
  return NextResponse.json({ id: result.id });
}
