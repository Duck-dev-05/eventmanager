import { cookies } from "next/headers";

const messages: Record<string, string> = {
  google: "Google sign-in did not complete. Please try again.",
};

export async function AuthNotice() {
  const code = (await cookies()).get("auth_notice")?.value;
  const message = code ? messages[code] : undefined;

  if (!message) return null;

  return (
    <p
      role="alert"
      className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600"
    >
      {message}
    </p>
  );
}
