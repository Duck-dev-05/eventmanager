import { Suspense } from "react";

// The post-signup return path comes from the query string at request time.
export const instant = false;
import { AuthForm } from "@/components/auth-form";
import { AuthNotice } from "@/components/auth-notice";
import { AuthShell } from "@/components/auth-shell";
import { signUp } from "@/lib/auth-actions";
import { isGoogleEnabled } from "@/lib/google";

export const metadata = {
  title: "Create account — EventPulse",
};

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const { next } = await searchParams;
  const returnTo = typeof next === "string" && next.startsWith("/") ? next : undefined;

  return (
    <AuthShell>
      <div className="w-full">
        <Suspense fallback={null}>
          <AuthNotice />
        </Suspense>
        <AuthForm
          mode="register"
          action={signUp}
          googleEnabled={isGoogleEnabled()}
          returnTo={returnTo}
        />
      </div>
    </AuthShell>
  );
}
