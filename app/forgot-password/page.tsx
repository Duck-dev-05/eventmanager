import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { CalendarIcon } from "@/components/icons";

export const metadata = {
  title: "Forgot password — EventPulse",
};

export default function ForgotPasswordPage() {
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
            Reset your password
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">
            Enter the email address tied to your account and we&apos;ll send you a
            recovery link that works for 60 minutes.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="mt-7 text-center text-[13px] text-zinc-500">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
