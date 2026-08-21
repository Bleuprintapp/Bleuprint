import { SignOutButton, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function emailFor(user) {
  return user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() || "";
}

export default async function AdminPortal() {
  const user = await currentUser();
  if (emailFor(user) !== "kalenagardner07@gmail.com") redirect("/portal");

  return (
    <main className="portal-page admin-page">
      <header className="private-header">
        <a href="/index.html" className="private-brand">Bleuprint</a>
        <nav><a href="/index.html">Public site</a><SignOutButton><button type="button">Sign out</button></SignOutButton><UserButton /></nav>
      </header>
      <div className="portal-layout">
        <aside className="private-sidebar">
          <span className="is-active">Overview</span><span>Submissions</span><span>Clients</span><span>Reviews</span><span>Site</span>
        </aside>
        <section className="private-content">
          <p className="portal-kicker">Private administration</p>
          <h1>Bleuprint admin</h1>
          <p className="portal-lede">This page is restricted to {"kalenagardner07@gmail.com"}. It is not part of the public website.</p>
          <div className="private-grid admin-grid">
            <a className="private-card link-card" href="https://mail.google.com/" target="_blank" rel="noreferrer"><span>Self-check submissions</span><strong>Open the Bleuprint Gmail inbox</strong><p>The Ten currently delivers each founder’s answers by email.</p></a>
            <a className="private-card link-card" href="https://mail.google.com/" target="_blank" rel="noreferrer"><span>Client reviews</span><strong>Open review submissions</strong><p>Reviews and sharing permissions currently arrive by email.</p></a>
            <a className="private-card link-card" href="https://calendly.com/kalenagardner07/30min" target="_blank" rel="noreferrer"><span>Meetings</span><strong>Open Calendly</strong><p>Review upcoming diagnosis and client sessions.</p></a>
            <a className="private-card link-card" href="https://dashboard.clerk.com/" target="_blank" rel="noreferrer"><span>Client access</span><strong>Manage workspace users</strong><p>Invite or remove people who can sign into Bleuprint.</p></a>
            <a className="private-card link-card" href="https://vercel.com/bleuprint/bleuprint" target="_blank" rel="noreferrer"><span>Website</span><strong>Open Vercel</strong><p>View deployments and domain status.</p></a>
            <a className="private-card link-card" href="https://github.com/Bleuprintapp/Bleuprint/pull/1" target="_blank" rel="noreferrer"><span>Website changes</span><strong>Open the GitHub review</strong><p>Review the branch before publishing it to production.</p></a>
          </div>
        </section>
      </div>
    </main>
  );
}
