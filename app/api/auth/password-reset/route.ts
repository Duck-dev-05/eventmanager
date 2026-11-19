import { NextResponse } from "next/server";
import { requestIdentifier } from "@/lib/client-ip";
import { requestPasswordResetForEmail } from "@/lib/password-reset-service";

export async function POST(request: Request) {
  let email: unknown;
  try {
    const body = await request.json() as { email?: unknown };
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Enter the email address for your account." }, { status: 400 });
  }

  const state = await requestPasswordResetForEmail(email, await requestIdentifier());
  return NextResponse.json(state);
}
