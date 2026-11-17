import { connection } from "next/server";
import { getSessionUser } from "@/lib/session-cookie";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export async function Greeting() {
  await connection();
  const user = await getSessionUser();

  return <>Welcome back{user ? `, ${firstName(user.name)}` : ""}</>;
}
