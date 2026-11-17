import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/avatar";
import { PrimaryLink, primaryButton, secondaryButton } from "@/components/ui";
import { CalendarIcon, UsersIcon } from "@/components/icons";
import { findEventInvite } from "@/lib/events";
import { shortDate } from "@/lib/event-format";
import { ROLE_LABELS, ROLE_SUMMARIES } from "@/lib/roles";
import { acceptInvite, declineInvite } from "@/lib/member-actions";
import { getSessionUser } from "@/lib/session-cookie";

// Invitation tokens and the invitee's session only exist at request time.
export const instant = false;

function InviteSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="h-[340px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white" />
    </div>
  );
}

async function Invite({
  token,
  error,
}: {
  token: string;
  error?: string;
}) {
  await connection();

  const user = await getSessionUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const invite = await findEventInvite(token);
  if (!invite || invite.invitedEmail !== user.email.toLowerCase()) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white p-7 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-100/80 to-fuchsia-100/50 blur-3xl"
        />

        <div className="relative flex items-center gap-3.5">
          {invite.inviterAvatarUrl ? (
            <Avatar
              src={invite.inviterAvatarUrl}
              initials={invite.inviterName?.slice(0, 2).toUpperCase()}
              size="lg"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
              <UsersIcon className="h-6 w-6" />
            </span>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Event invitation
            </p>
            {invite.inviterName ? (
              <p className="text-[13px] text-zinc-600">
                From <strong className="font-semibold text-zinc-900">{invite.inviterName}</strong>
              </p>
            ) : null}
          </div>
        </div>

        <h1 className="relative mt-5 text-[24px] font-semibold leading-tight tracking-tight text-zinc-900">
          You&apos;ve been invited to &ldquo;{invite.eventTitle}&rdquo;
        </h1>
        <p className="relative mt-2 text-[13.5px] leading-relaxed text-zinc-500">
          Accept to collaborate on this event. You&apos;ll join as{" "}
          <strong className="font-semibold text-zinc-700">
            {ROLE_LABELS[invite.role]}
          </strong>{" "}
          — {ROLE_SUMMARIES[invite.role]}.
        </p>

        <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-medium text-zinc-500">
          <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
          Invitation expires {shortDate.format(new Date(invite.expiresAt))}
        </p>

        {error ? (
          <p
            role="alert"
            className="relative mt-5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-600 ring-1 ring-inset ring-rose-100"
          >
            {error}
          </p>
        ) : null}

        <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <form action={acceptInvite} className="sm:flex-1">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={`w-full ${primaryButton}`}>
              Accept invitation
            </button>
          </form>

          <form action={declineInvite} className="sm:flex-1">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={`w-full ${secondaryButton}`}>
              Decline
            </button>
          </form>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-zinc-100 pt-4 text-[12px] text-zinc-500">
          <Avatar
            src={user.avatarUrl}
            initials={user.name?.slice(0, 2).toUpperCase()}
            size="sm"
          />
          <span>
            Signed in as <strong className="font-semibold text-zinc-800">{user.name}</strong> ({user.email}).{" "}
            <PrimaryLink href="/my-events">Go to my events</PrimaryLink>
          </span>
        </div>
      </section>
    </div>
  );
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Invite token={token} error={error} />
    </Suspense>
  );
}
