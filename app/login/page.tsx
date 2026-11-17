import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthNotice } from "@/components/auth-notice";
import { AuthShell } from "@/components/auth-shell";
import { signIn } from "@/lib/auth-actions";
import { isGoogleEnabled } from "@/lib/google";

export const metadata = {
  title: "Sign in — EventPulse",
};

// The post-login return path comes from the query string at request time.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
  const returnTo = typeof next === "string" && next.startsWith("/") ? next : undefined;

  return (
    <AuthShell>
      <div className="w-full">
        <Suspense fallback={null}>
          <AuthNotice />
        </Suspense>
        <AuthForm
          mode="login"
          action={signIn}
          googleEnabled={isGoogleEnabled()}
          returnTo={returnTo}
        />
      </div>
    </AuthShell>
  );
}
