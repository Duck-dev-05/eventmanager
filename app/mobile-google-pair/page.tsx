import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

export default async function MobileGooglePairPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6fb", padding: 24 }}>
      <section style={{ maxWidth: 420, borderRadius: 20, background: "white", padding: 32, color: "#20243b", fontFamily: "system-ui,sans-serif", boxShadow: "0 12px 40px #20243b18" }}>
        <h1 style={{ color: "#267b50", fontSize: 24 }}>Android sign-in complete</h1>
        <p style={{ lineHeight: 1.6, color: "#687085" }}>You can return to EventPulse. Your phone will finish connecting securely.</p>
        <p style={{ lineHeight: 1.6, color: "#687085" }}>This page can be closed.</p>
      </section>
    </main>
  );
}
