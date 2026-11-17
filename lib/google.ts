import {
  createHash,
  createPublicKey,
  randomBytes,
  verify as verifySignature,
} from "node:crypto";
type SigningKey = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
};

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: number;
};

export function isGoogleEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function getGoogleConfig(origin: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const baseUrl = (process.env.APP_URL?.trim() || origin).replace(/\/$/, "");

  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/v1/auth/google/callback`,
  };
}

export function createState() {
  return randomBytes(24).toString("base64url");
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl({
  config,
  state,
  challenge,
}: {
  config: GoogleConfig;
  state: string;
  challenge: string;
}) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeCode({
  code,
  config,
  verifier,
}: {
  code: string;
  config: GoogleConfig;
  verifier: string;
}) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  return (await response.json()) as { id_token?: string };
}

async function getSigningKey(kid: string | undefined) {
  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) return null;

  const { keys } = (await response.json()) as { keys?: SigningKey[] };

  return keys?.find((key) => key.kid === kid) ?? null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleClaims | null> {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return null;

  let header: { alg?: string; kid?: string };
  let claims: GoogleClaims;

  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    claims = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as GoogleClaims;
  } catch {
    return null;
  }

  if (header.alg !== "RS256") return null;
  if (claims.aud !== clientId) return null;
  if (
    claims.iss !== "https://accounts.google.com" &&
    claims.iss !== "accounts.google.com"
  ) {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
    return null;
  }

  const verified =
    claims.email_verified === true || claims.email_verified === "true";
  if (!verified || !claims.email) return null;

  const jwk = await getSigningKey(header.kid);
  if (!jwk?.kty || !jwk.n || !jwk.e) return null;

  try {
    const publicKey = createPublicKey({
      key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
      format: "jwk",
    });
    const signatureValid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      publicKey,
      Buffer.from(signaturePart, "base64url"),
    );

    return signatureValid ? claims : null;
  } catch {
    return null;
  }
}
