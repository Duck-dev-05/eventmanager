import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Signed-in users are sent away from sign-in/sign-up, but password recovery
// stays reachable — reset links are followed while a session is still active.
const authPages = ["/login", "/register"];
const passwordPages = ["/forgot-password", "/reset-password"];
const publicPaths = [
  ...authPages,
  ...passwordPages,
  "/api/v1/auth/google",
  "/invite",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const matches = (paths: string[]) =>
    paths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  if (!session && !matches(publicPaths)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (session && (matches(authPages) || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // API routes authenticate themselves; skipping them keeps multipart uploads intact.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
