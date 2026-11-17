import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eventpulse_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const DEVELOPMENT_SECRET = "eventpulse-development-secret";

/**
 * Fail closed: a production deploy without AUTH_SECRET would otherwise sign
 * every session with a secret that is published in this repository, which
 * makes session cookies forgeable.
 */
function sessionSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production. Set it to a long random value before starting the app.",
    );
  }

  return DEVELOPMENT_SECRET;
}

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  exp: number;
};

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(
  token: string | null | undefined,
): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!payload.userId || typeof payload.exp !== "number") return null;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
