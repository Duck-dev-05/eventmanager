"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeMemberRole,
  declineInvitation,
  leaveEvent,
  removeMember,
  resendInvitation,
} from "@/lib/member-actions";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  normalizeRole,
  rolePermissions,
  type EventRole,
} from "@/lib/roles";
import { Avatar } from "./avatar";
import { InlineNotice } from "./inline-notice";
import { InviteMemberForm } from "./invite-member-form";

const AVATAR_GRADIENTS = [
  "from-[#193b30] to-[#2d5c47]", // forest
  "from-[#1e3a5f] to-[#2d5c8c]", // ocean
  "from-[#4a1942] to-[#7b2d6e]", // plum
  "from-[#5c2d1e] to-[#8c4a30]", // amber
  "from-[#1a3a5c] to-[#2a5c82]", // slate
  "from-[#2d3a1e] to-[#4e6b35]", // olive
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

type Member = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: EventRole;
  avatarUrl?: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: EventRole;
  name?: string;
  avatarUrl?: string | null;
};

type Person = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export function EventMembersClient({
  role,
  owner,
  currentUserId,
  members,
  invitations,
  eventId,
}: {
  role: EventRole;
  owner: Person;
  currentUserId: string;
  members: Member[];
  invitations: Invitation[];
  eventId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<
    { tone: "error" | "success"; text: string } | null
  >(null);

  const { canManageTeam, canChangeRoles, canLeave } = rolePermissions(role);
  const total = members.length + 1;

  function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the event?")) return;

    setBusy(memberId);
    startTransition(async () => {
      const result = await removeMember(eventId, memberId);
      setBusy(null);
      if (result.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleRoleChange(memberId: string, nextRole: string) {
    setBusy(`role:${memberId}`);
    startTransition(async () => {
      const result = await changeMemberRole(eventId, memberId, nextRole);
      setBusy(null);
      if (result.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleLeave() {
    if (
      !confirm(
        "Leave this event? You'll lose access until someone invites you again.",
      )
    ) {
      return;
    }

    setBusy("leave");
    startTransition(async () => {
      const result = await leaveEvent(eventId);
      setBusy(null);
      if (result.success) {
        router.push("/my-events");
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleResend(inviteId: string) {
    setBusy(`resend:${inviteId}`);
    startTransition(async () => {
      const result = await resendInvitation(inviteId);
      setBusy(null);
      if (result.success) {
        setNotice({
          tone: "success",
          text: result.message ?? "Invitation re-sent.",
        });
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  function handleDecline(inviteId: string) {
    if (!confirm("Decline this pending invitation?")) return;

    setBusy(inviteId);
    startTransition(async () => {
      const result = await declineInvitation(inviteId);
      setBusy(null);
      if (result.success) {
        setNotice(null);
        router.refresh();
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-6 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Team
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Members with access and pending invitations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#f0ede5] px-2.5 py-1 text-[12px] font-medium text-zinc-700">
            {total} {total === 1 ? "member" : "members"}
            {invitations.length > 0 ? ` · ${invitations.length} invited` : ""}
          </span>
          {canManageTeam ? <InviteMemberForm eventId={eventId} /> : null}
        </div>
      </div>

      {notice ? (
        <InlineNotice tone={notice.tone} className="mx-6 mb-3 mt-3">
          {notice.text}
        </InlineNotice>
      ) : null}

      <ul className="divide-y divide-[#f2efe8]">
        <li className="flex items-center gap-3 px-6 py-4">
          <Avatar
            src={owner.avatarUrl}
            initials={owner.name.slice(0, 2).toUpperCase()}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-zinc-900">
              {owner.name}
              {owner.id === currentUserId ? " (you)" : ""}
            </p>
            {owner.email ? (
              <a
                href={`mailto:${owner.email}`}
                className="block truncate text-[12px] text-zinc-500 underline-offset-2 hover:text-[#193b30] hover:underline"
              >
                {owner.email}
              </a>
            ) : (
              <p className="truncate text-[12px] text-zinc-500">Organizer</p>
            )}
          </div>
          <span
            title={ROLE_DESCRIPTIONS.owner}
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100"
          >
            Owner
          </span>
        </li>

        {members.map((member) => {
          const memberRole = normalizeRole(member.role);

          return (
            <li key={member.id} className="flex items-center gap-3 px-6 py-4">
              <Avatar
                src={member.avatarUrl}
                initials={member.name.slice(0, 2).toUpperCase()}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-zinc-900">
                  {member.name}
                  {member.id === currentUserId ? " (you)" : ""}
                </p>
                <p className="truncate text-[12px] text-zinc-500">
                  {member.email}
                </p>
              </div>

              {canChangeRoles && member.id !== currentUserId ? (
                <select
                  value={memberRole}
                  onChange={(event) =>
                    handleRoleChange(member.id, event.target.value)
                  }
                  disabled={pending && busy === `role:${member.id}`}
                  aria-label={`Role for ${member.name}`}
                  title={ROLE_DESCRIPTIONS[memberRole]}
                  className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 outline-none transition focus:border-[#d9773e] focus:ring-2 focus:ring-[#f6e3d2] disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  title={ROLE_DESCRIPTIONS[memberRole]}
                  className={
                    memberRole === "admin"
                      ? "rounded-full bg-[#fdf0e4] px-2.5 py-1 text-[12px] font-semibold text-[#a8542a] ring-1 ring-inset ring-[#f2dcc8]"
                      : "rounded-full bg-sky-50 px-2.5 py-1 text-[12px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200"
                  }
                >
                  {ROLE_LABELS[memberRole]}
                </span>
              )}

              {canManageTeam ? (
                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
                  disabled={pending && busy === member.id}
                  aria-label={`Remove ${member.name}`}
                  className="ml-2 rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  {pending && busy === member.id ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {invitations.length > 0 ? (
        <div className="border-t border-[#f0ede5]">
          <p className="px-6 pt-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Pending invitations
          </p>
          <ul className="mt-2 divide-y divide-[#f2efe8]">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 px-6 py-4"
              >
                {invitation.avatarUrl ? (
                  <Avatar
                    src={invitation.avatarUrl}
                    initials={(invitation.name ?? invitation.email)
                      .slice(0, 2)
                      .toUpperCase()}
                    size="lg"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[15px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/60">
                    {invitation.email.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-700">
                  {invitation.email}
                </p>
                <span
                  title={`Invited as ${ROLE_LABELS[normalizeRole(invitation.role)]}`}
                  className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-100"
                >
                  {ROLE_LABELS[normalizeRole(invitation.role)]}
                </span>
                {canManageTeam ? (
                  <button
                    type="button"
                    onClick={() => handleResend(invitation.id)}
                    disabled={pending && busy === `resend:${invitation.id}`}
                    aria-label={`Resend invitation for ${invitation.email}`}
                    className="ml-2 rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50"
                  >
                    {pending && busy === `resend:${invitation.id}`
                      ? "Sending…"
                      : "Resend"}
                  </button>
                ) : null}
                {canManageTeam ? (
                  <button
                    type="button"
                    onClick={() => handleDecline(invitation.id)}
                    disabled={pending && busy === invitation.id}
                    aria-label={`Cancel invitation for ${invitation.email}`}
                    className="ml-2 rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50"
                  >
                    {pending && busy === invitation.id
                      ? "Cancelling…"
                      : "Cancel"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {members.length === 0 && canManageTeam ? (
        <p className="border-t border-[#f0ede5] px-6 py-4 text-[12.5px] text-zinc-400">
          No teammates yet. Use “Invite member” to give someone access to this
          event.
        </p>
      ) : null}

      {members.length === 0 && !canManageTeam ? (
        <p className="border-t border-[#f0ede5] px-6 py-4 text-[12.5px] text-zinc-400">
          You&apos;re the only member here so far.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0ede5] px-6 py-4">
        <p className="text-[12.5px] text-zinc-400">
          {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
        </p>
        {canLeave ? (
          <button
            type="button"
            onClick={handleLeave}
            disabled={pending && busy === "leave"}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-zinc-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            {pending && busy === "leave" ? "Leaving…" : "Leave event"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
