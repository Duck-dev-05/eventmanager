import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit, resetRateLimit, retryMessage } from "../lib/rate-limit.ts";

test("allows hits up to the limit, then blocks", () => {
  const key = "test:limit";

  assert.deepEqual(
    checkRateLimit({ key, limit: 2, windowMs: 60_000, now: 0 }),
    { allowed: true, remaining: 1 },
  );
  assert.deepEqual(
    checkRateLimit({ key, limit: 2, windowMs: 60_000, now: 1 }),
    { allowed: true, remaining: 0 },
  );

  const blocked = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: 2 });
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.retryAfterSeconds, 60);
  }
});

test("starts a fresh window once the old one expires", () => {
  const key = "test:window";

  assert.equal(
    checkRateLimit({ key, limit: 1, windowMs: 10_000, now: 0 }).allowed,
    true,
  );
  assert.equal(
    checkRateLimit({ key, limit: 1, windowMs: 10_000, now: 5_000 }).allowed,
    false,
  );
  assert.equal(
    checkRateLimit({ key, limit: 1, windowMs: 10_000, now: 10_001 }).allowed,
    true,
  );
});

test("successful attempts can clear their bucket", () => {
  const key = "test:reset";

  checkRateLimit({ key, limit: 1, windowMs: 60_000, now: 0 });
  assert.equal(
    checkRateLimit({ key, limit: 1, windowMs: 60_000, now: 1 }).allowed,
    false,
  );

  resetRateLimit(key);
  assert.equal(
    checkRateLimit({ key, limit: 1, windowMs: 60_000, now: 2 }).allowed,
    true,
  );
});

test("buckets are isolated per key", () => {
  const now = 0;
  assert.equal(
    checkRateLimit({ key: "test:a", limit: 1, windowMs: 60_000, now }).allowed,
    true,
  );
  assert.equal(
    checkRateLimit({ key: "test:b", limit: 1, windowMs: 60_000, now }).allowed,
    true,
  );
  assert.equal(
    checkRateLimit({ key: "test:a", limit: 1, windowMs: 60_000, now }).allowed,
    false,
  );
});

test("retry messages read naturally", () => {
  assert.equal(
    retryMessage(30),
    "Too many attempts. Try again in 1 minute.",
  );
  assert.equal(
    retryMessage(600),
    "Too many attempts. Try again in 10 minutes.",
  );
});
