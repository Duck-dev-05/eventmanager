"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/lib/auth-types";
import { CalendarIcon, GoogleIcon } from "./icons";

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>;

const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200/90 bg-zinc-50/60 px-3.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-[12.5px] font-medium text-zinc-600";

export function AuthForm({
  mode,
  action,
  googleEnabled = false,
  returnTo,
}: {
  mode: "login" | "register";
  action: AuthAction;
  googleEnabled?: boolean;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isLogin = mode === "login";

  return (
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
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500">
          {isLogin
            ? "Sign in to manage the events you run and follow."
            : "Start running and tracking your events."}
        </p>
      </div>

      {googleEnabled ? (
        <>
          <a
            href={
              returnTo
                ? `/api/v1/auth/google?next=${encodeURIComponent(returnTo)}`
                : "/api/v1/auth/google"
            }
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white text-[13.5px] font-medium text-zinc-700 shadow-sm shadow-zinc-900/[0.02] transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <GoogleIcon className="h-[18px] w-[18px]" />
            Continue with Google
          </a>
          <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            or
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      ) : null}

      <form action={formAction} className="space-y-4">
        {returnTo ? <input type="hidden" name="next" value={returnTo} /> : null}
        {!isLogin && (
          <div>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              defaultValue={state?.values?.name}
              placeholder="Your name"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.values?.email}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            {isLogin ? (
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-indigo-600 transition hover:underline"
              >
                Forgot password?
              </Link>
            ) : null}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : 8}
            placeholder={isLogin ? "Your password" : "At least 8 characters"}
            className={inputClass}
          />
        </div>

        {!isLogin && (
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Repeat your password"
              className={inputClass}
            />
          </div>
        )}

        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600 ring-1 ring-inset ring-rose-100"
          >
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-[13px] text-zinc-500">
        {isLogin ? (
          <>
            New to EventPulse?{" "}
            <Link
              href={returnTo ? `/register?next=${encodeURIComponent(returnTo)}` : "/register"}
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login"}
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
