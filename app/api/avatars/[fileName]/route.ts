import { NextResponse } from "next/server";
import { getObject } from "@/lib/storage";
import { findUserById } from "@/lib/users";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  const match = /^([a-z0-9-]{8,64})\.(png|jpe?g|webp)$/i.exec(fileName);

  if (!match) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [, userId, extension] = match;
  const user = await findUserById(userId);

  if (!user?.avatarUrl?.startsWith("/api/avatars/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await getObject(
      `avatars/${userId}.${extension.toLowerCase() === "jpeg" ? "jpg" : extension.toLowerCase()}`,
    );

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension.toLowerCase()] ?? "image/png",
        "Content-Length": String(file.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
