import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import {
  ArrowRightIcon,
  CalendarIcon,
  MapPinIcon,
  MailIcon,
} from "@/components/icons";
import { acceptInvite, declineInvite } from "@/lib/member-actions";
import { listInvitesForEmail, type IncomingInvite } from "@/lib/events";
import { longDate, startTime } from "@/lib/event-format";
import { ROLE_LABELS } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";

type InviteStatus = "pending" | "accepted" | "declined";

const statusTabs: Array<{ key: InviteStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];

const expiresFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function parseStatus(value?: string): InviteStatus {
  return value === "accepted" || value === "declined" ? value : "pending";
}

function InvitationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded-full bg-white" />
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-[152px] animate-pulse rounded-2xl border border-zinc-200/70 bg-white"
        />
      ))}
    </div>
  );
}

function StatusTabs({
  active,
  counts,
}: {
  active: InviteStatus;
  counts: Record<InviteStatus, number>;
}) {
  return (
    <nav
      aria-label="Invitation status"
      className="flex flex-wrap items-center gap-1.5"
    >
      {statusTabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Link
            key={tab.key}
            href={`/invitations?status=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-full bg-[#193b30] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm"
                : "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            }
          >
            {tab.label}
            <span
              className={
                isActive
                  ? "rounded-full bg-white/15 px-1.5 text-[10.5px] tabular-nums"
                  : "rounded-full bg-zinc-100 px-1.5 text-[10.5px] tabular-nums text-zinc-500"
              }
            >
              {counts[tab.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyTab({
  status,
  email,
}: {
  status: InviteStatus;
  email: string;
}) {
  const copy = {
    pending: {
      title: "No invitations waiting",
      description: `When an organiser invites ${email}, it will show up here with accept and decline buttons. To invite people, open one of your events and use its Members tab. To join someone else's event, ask its organiser to invite this account.`,
      cta: { href: "/my-events", label: "Invite people" },
    },
    accepted: {
      title: "Nothing accepted yet",
      description:
        "Invitations you accept move here, and the event appears in My Events.",
      cta: { href: "/my-events", label: "Open My Events" },
    },
    declined: {
      title: "No declined invitations",
      description:
        "Invitations you decline are kept here for reference, so you can ask the organiser for a new link.",
      cta: { href: "/my-events", label: "Back to your events" },
    },
  }[status];

  return (
    <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        <MailIcon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[14px] font-semibold text-zinc-900">
        {copy.title}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        {copy.description}
      </p>
      <Link
        href={copy.cta.href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#193b30] px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-[#142e26]"
      >
        {copy.cta.label}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function InviteCard({ invite }: { invite: IncomingInvite }) {
  const startsAt = new Date(invite.startsAt);
  const isPending = invite.status === "pending";
  const isAccepted = invite.status === "accepted";

  return (
    <li
      className={
        isPending
          ? "rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]"
          : "rounded-2xl border border-zinc-200/60 bg-white/70 p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {ROLE_LABELS[invite.role]}
            </span>
            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
              {invite.category}
            </span>
            {isAccepted ? (
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                Joined
              </span>
            ) : null}
            {invite.status === "declined" ? (
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200">
                Declined
              </span>
            ) : null}
          </div>

          <h2 className="mt-2 text-[16px] font-semibold tracking-tight text-zinc-900">
            {invite.eventTitle}
          </h2>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            {invite.inviterName
              ? `${invite.inviterName} invited you as ${ROLE_LABELS[invite.role]}.`
              : `You were invited as ${ROLE_LABELS[invite.role]}.`}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
              {longDate.format(startsAt)} · {startTime.format(startsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
              {invite.venue || "Location to be announced"}
            </span>
          </p>
        </div>

        {isPending ? (
          <span className="text-[11.5px] text-zinc-400">
            Expires {expiresFormatter.format(new Date(invite.expiresAt))}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={invite.token} />
            <button
              type="submit"
              className="inline-flex items-center rounded-xl bg-[#193b30] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#142e26]"
            >
              Accept invitation
            </button>
          </form>
          <form action={declineInvite}>
            <input type="hidden" name="token" value={invite.token} />
            <button
              type="submit"
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
            >
              Decline
            </button>
          </form>
        </div>
      ) : null}

      {isAccepted ? (
        <Link
          href={`/events/${invite.eventId}`}
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Open event
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      ) : null}

      {invite.status === "declined" ? (
        <p className="mt-4 text-[12px] text-zinc-400">
          Ask the organiser for a new invitation if you change your mind.
        </p>
      ) : null}
    </li>
  );
}

async function Invitations({ status }: { status: InviteStatus }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const invites = await listInvitesForEmail(user.email);
  const counts: Record<InviteStatus, number> = {
    pending: 0,
    accepted: 0,
    declined: 0,
  };

  for (const invite of invites) counts[invite.status] += 1;

  const visible = invites.filter((invite) => invite.status === status);

  return (
    <div className="space-y-4">
      <StatusTabs active={status} counts={counts} />

      {visible.length === 0 ? (
        <EmptyTab status={status} email={user.email} />
      ) : (
        <ul className="space-y-3">
          {visible.map((invite) => (
            <InviteCard key={invite.id} invite={invite} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InvitationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Inbox"
        title="Invitations"
        description="Events people have invited you to join."
      />

      <Suspense fallback={<InvitationsSkeleton />}>
        {(searchParams ?? Promise.resolve(undefined)).then((params) => (
          <Invitations status={parseStatus(params?.status)} />
        ))}
      </Suspense>
    </div>
  );
}
