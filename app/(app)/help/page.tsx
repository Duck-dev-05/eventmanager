import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { primaryButton } from "@/components/ui";
import {
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  MailIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";

const shortcuts = [
  {
    href: "/profile",
    label: "Your profile",
    description: "Update your display name and review your account.",
    Icon: UserIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Control reminders and default event values.",
    Icon: SettingsIcon,
  },
  {
    href: "/notifications",
    label: "Notifications",
    description: "See reminders and events shared with you.",
    Icon: BellIcon,
  },
];

const faqs = [
  {
    question: "How do I invite someone to an event?",
    answer:
      "Open the event, go to the Members tab and enter the email address of a teammate who already has an account. Only the event owner can invite people, and invited teammates get access right away.",
  },
  {
    question: "Why can't I see an event that was shared with me?",
    answer:
      "Shared events show up in My Events as soon as the owner invites the email address on your account. If it is missing, ask the owner to check which address they used.",
  },
  {
    question: "How do I change the name shown in the app?",
    answer:
      "Open your profile from the account menu, update the display name and save. The new name appears in the sidebar and anywhere your events are listed.",
  },
  {
    question: "What do the Upcoming and Past badges mean?",
    answer:
      "An event is Upcoming until its start time passes, then it moves to Past automatically. Events stay in My Events either way.",
  },
  {
    question: "How do I turn reminders on or off?",
    answer:
      "Go to Settings and use the notification toggles. You can also set a default capacity there so new events start with the value you usually use.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account"
        title="Help & support"
        description="Answers to the questions that come up most often, plus the fastest way to reach us."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {shortcuts.map(({ href, label, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600">
              {label}
              <ChevronRightIcon className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-indigo-500" />
            </span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-zinc-500">
              {description}
            </span>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              Frequently asked questions
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Short answers for the everyday flow.
            </p>
          </div>

          <div className="divide-y divide-zinc-100">
            {faqs.map((faq) => (
              <details key={faq.question} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-medium text-zinc-900 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 pr-8 text-[12.5px] leading-relaxed text-zinc-500">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <MailIcon className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-zinc-900">
            Still stuck?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            Send us a note with the event name and what you expected to happen. We
            usually reply within one working day.
          </p>
          <a
            href="mailto:support@eventpulse.app"
            className={`mt-5 ${primaryButton}`}
          >
            <MailIcon className="h-4 w-4" />
            Email support
          </a>

          <div className="mt-6 rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/80">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-900">
              <HelpCircleIcon className="h-4 w-4 text-zinc-400" />
              A quick tip
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              The account menu in the top bar links to your profile, settings,
              notifications and this page from anywhere.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
