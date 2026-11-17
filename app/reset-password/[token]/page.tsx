import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { CalendarIcon } from "@/components/icons";

export const metadata = {
  title: "Set new password — EventPulse",
};

// The reset token only exists per request, so this route is allowed to block.
export const instant = false;

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell>
      <div className="w-full">
        <div className="mb-7">
          <span className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-600/30">
              <CalendarIcon className="h-[19px] w-[19px]" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight text-zinc-900">
              EventPulse
            </span>
          </span>

          <h1 className="mt-7 text-[27px] font-semibold tracking-tight text-zinc-900 lg:mt-0">
            Set new password
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">
            Create a secure password with at least 8 characters. This link can
            only be used once.
          </p>
        </div>

        <ResetPasswordForm token={token} />

        <p className="mt-7 text-center text-[13px] text-zinc-500">
          <Link
            href="/login"
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Cancel and return to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
