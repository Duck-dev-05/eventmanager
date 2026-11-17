import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "../lib/session.ts";

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    userId: "user-1",
    email: "owner@example.com",
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

test("verifies a token it just created", () => {
  const token = createSessionToken(payload());
  const verified = verifySessionToken(token);

  assert.equal(verified?.userId, "user-1");
  assert.equal(verified?.email, "owner@example.com");
});

test("rejects a tampered payload", () => {
  const token = createSessionToken(payload());
  const [body, signature] = token.split(".");

  const forgedBody = Buffer.from(
    JSON.stringify({ ...payload(), userId: "someone-else" }),
  ).toString("base64url");

  assert.equal(verifySessionToken(`${forgedBody}.${signature}`), null);
  assert.equal(verifySessionToken(`${body}.not-a-signature`), null);
});

test("rejects expired tokens", () => {
  const token = createSessionToken(payload({ exp: Date.now() - 1 }));
  assert.equal(verifySessionToken(token), null);
});

test("rejects malformed values", () => {
  assert.equal(verifySessionToken(null), null);
  assert.equal(verifySessionToken(""), null);
  assert.equal(verifySessionToken("garbage"), null);
  assert.equal(verifySessionToken("a.b.c"), null);
});
