import assert from "node:assert/strict";
import test from "node:test";
import { resolveAvatarUrl } from "../lib/avatar.ts";

test("keeps non-Google https avatars untouched", () => {
  assert.equal(
    resolveAvatarUrl("https://cdn.example.com/photo.jpg"),
    "https://cdn.example.com/photo.jpg",
  );
});

test("upgrades Google avatars to a crisp size", () => {
  assert.equal(
    resolveAvatarUrl("https://lh3.googleusercontent.com/a/abc=s96-c"),
    "https://lh3.googleusercontent.com/a/abc=s256-c",
  );
  assert.equal(
    resolveAvatarUrl("https://lh3.googleusercontent.com/a/abc=w128-h128"),
    "https://lh3.googleusercontent.com/a/abc=s256-c",
  );
});

test("accepts locally served uploads", () => {
  assert.equal(
    resolveAvatarUrl("/api/avatars/user-1.png?v=123"),
    "/api/avatars/user-1.png?v=123",
  );
});

test("rejects scripts, protocols and junk", () => {
  assert.equal(resolveAvatarUrl("javascript:alert(1)"), undefined);
  assert.equal(resolveAvatarUrl("data:image/svg+xml,<svg/>"), undefined);
  assert.equal(resolveAvatarUrl("//evil.example.com/x.png"), undefined);
  assert.equal(resolveAvatarUrl("not a url"), undefined);
  assert.equal(resolveAvatarUrl(""), undefined);
  assert.equal(resolveAvatarUrl(null), undefined);
});
