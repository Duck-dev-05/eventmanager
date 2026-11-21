import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthorizationUrl, createPkcePair, createState, getGoogleConfig } from "@/lib/google";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function validSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(sha256(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET() {
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue to Google</title></head><body><p id="status">Connecting securely to Google…</p><script nonce="${nonce}">
(async()=>{const status=document.getElementById('status');const params=new URLSearchParams(location.hash.slice(1));const id=params.get('id');const launchCode=params.get('code');history.replaceState(null,'',location.pathname);if(!id||!launchCode){status.textContent='This sign-in link is invalid. Return to EventPulse and try again.';return;}try{const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,launchCode})});const result=await response.json();if(!response.ok||typeof result.url!=='string')throw new Error(result.error||'Could not start Google sign-in.');location.replace(result.url);}catch(error){status.textContent=error instanceof Error?error.message:'Could not start Google sign-in. Return to the app and try again.';}})();
</script></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  let body: { id?: unknown; launchCode?: unknown };
  try {
    body = await request.json() as { id?: unknown; launchCode?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid Android sign-in request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const launchCode = typeof body.launchCode === "string" ? body.launchCode : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || launchCode.length < 32 || launchCode.length > 128) {
    return NextResponse.json({ error: "Invalid Android sign-in link." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = await getDb();
  const pairing = await db.prepare(
    `SELECT launch_code_hash, status, expires_at
     FROM mobile_google_pairing_sessions WHERE id = ?`,
  ).get(id) as { launch_code_hash: string; status: string; expires_at: string } | undefined;
  if (!pairing || pairing.status !== "pending" || pairing.expires_at <= new Date().toISOString() || !validSecret(launchCode, pairing.launch_code_hash)) {
    return NextResponse.json({ error: "Android sign-in link expired. Start Google sign-in again in the app." }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }

  const origin = new URL(request.url).origin;
  const config = getGoogleConfig(origin);
  if (!config) return NextResponse.json({ error: "Google sign-in is not configured for this website." }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const state = createState();
  const { verifier, challenge } = createPkcePair();
  const store = await cookies();
  store.set("google_oauth", JSON.stringify({ state, verifier, mobilePair: { id, launchCode } }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = buildAuthorizationUrl({ config, state, challenge });
  authorizationUrl.searchParams.set("prompt", "select_account");
  return NextResponse.json({ url: authorizationUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
}
