import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isAssignableRole,
  normalizeRole,
  rolePermissions,
  type EventRole,
} from "../lib/roles.ts";

test("owners can do everything", () => {
  const owner = rolePermissions("owner");
  assert.equal(owner.canManageTeam, true);
  assert.equal(owner.canManageFiles, true);
  assert.equal(owner.canEdit, true);
  assert.equal(owner.canDelete, true);
  assert.equal(owner.canChangeRoles, true);
  assert.equal(owner.canLeave, false);
  assert.equal(owner.readOnly, false);
});

test("admins manage the team but cannot change roles or leave", () => {
  const admin = rolePermissions("admin");
  assert.equal(admin.canManageTeam, true);
  assert.equal(admin.canManageFiles, true);
  assert.equal(admin.canDelete, true);
  assert.equal(admin.canChangeRoles, false);
  assert.equal(admin.canLeave, true);
});

test("members work on tasks but cannot delete", () => {
  const member = rolePermissions("member");
  assert.equal(member.canEdit, true);
  assert.equal(member.canDelete, false);
  assert.equal(member.canManageTeam, false);
  assert.equal(member.canManageFiles, false);
  assert.equal(member.canViewFiles, true);
});

test("viewers can read but never change anything", () => {
  const viewer = rolePermissions("viewer");
  assert.equal(viewer.canEdit, false);
  assert.equal(viewer.canDelete, false);
  assert.equal(viewer.canManageTeam, false);
  assert.equal(viewer.readOnly, true);
  assert.equal(viewer.canViewFiles, true);
});

test("every role has a label and description", () => {
  const allRoles: EventRole[] = ["owner", ...ASSIGNABLE_ROLES];

  for (const role of allRoles) {
    assert.ok(ROLE_LABELS[role], `missing label for ${role}`);
    assert.ok(ROLE_DESCRIPTIONS[role], `missing description for ${role}`);
  }
});

test("owner is never offered as an assignable role", () => {
  assert.equal(isAssignableRole("owner"), false);
  for (const role of ASSIGNABLE_ROLES) {
    assert.equal(isAssignableRole(role), true);
  }
  assert.equal(isAssignableRole("superuser"), false);
  assert.equal(isAssignableRole(null), false);
});

test("unknown stored roles fall back to member", () => {
  assert.equal(normalizeRole("owner"), "owner");
  assert.equal(normalizeRole("admin"), "admin");
  assert.equal(normalizeRole("viewer"), "viewer");
  assert.equal(normalizeRole("member"), "member");
  assert.equal(normalizeRole("root"), "member");
  assert.equal(normalizeRole(null), "member");
});
