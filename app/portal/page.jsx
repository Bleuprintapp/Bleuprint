import { SignOutButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function emailFor(user) {
  return user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() || "";
}

export default async function ClientPortal() {
  const user = await currentUser();
  const email = emailFor(user);
  if (email === "kalenagardner07@gmail.com") redirect("/admin");

  return (
    <main className="portal-page">
      <header className="private-header">
        <a href="/index.html" className="private-brand">Bleuprint</a>
        <nav><a href="/index.html">Public site</a><SignOutButton><button type="button">Sign out</button></SignOutButton><UserButton /></nav>
      </header>
      <div className="portal-layout">
        <aside className="private-sidebar">
          <span className="is-active">Current move</span><span>Full plan</span><span>Meetings</span><span>ICE</span><span>Founder opportunities</span>
        </aside>
        <section className="private-content">
          <p className="portal-kicker">Client workspace</p>
          <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ""}.</h1>
          <p className="portal-lede">Your active plan, meeting notes, and saved ideas will live here.</p>
          <article className="private-card current-card"><span>Current move</span><h2>Your workspace is ready for your Bleuprint plan.</h2><p>Kalena will connect your diagnosis and first move to this account.</p></article>
          <div className="private-grid">
            <article className="private-card"><span>Next meeting</span><strong>Scheduled with Kalena</strong></article>
            <article className="private-card"><span>Full plan</span><strong>Your sequenced moves</strong></article>
            <article className="private-card"><span>On ICE</span><strong>Ideas saved for later</strong></article>
          </div>
        </section>
      </div>
    </main>
  );
}
