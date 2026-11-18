import Link from "next/link";
import { connection } from "next/server";
import { signOut } from "@/lib/auth-actions";
import { initialsOf } from "@/lib/initials";
import { getSessionUser } from "@/lib/session-cookie";
import { Avatar } from "./avatar";
import { LogOutIcon } from "./icons";

export async function SidebarAccount() {
  await connection();
  const user = await getSessionUser();

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-line bg-sunken/70 p-2 shadow-panel">
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          title="Open your profile"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Avatar
            initials={initialsOf(user.name)}
            src={user.avatarUrl}
            size="md"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-ink">
              {user.name}
            </span>
            <span className="block truncate text-[11px] text-muted">
              {user.email}
            </span>
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-faint transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <LogOutIcon className="h-[17px] w-[17px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
