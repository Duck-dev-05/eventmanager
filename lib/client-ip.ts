import { headers } from "next/headers";

/**
 * Best-effort client identifier for rate-limit keys. Requests arrive through
 * the app itself, so the proxy header is the only signal available.
 */
export async function requestIdentifier() {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || store.get("x-real-ip")?.trim() || "local";
}
