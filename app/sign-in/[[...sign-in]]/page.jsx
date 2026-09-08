"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
    if (response.ok) { router.push("/admin"); router.refresh(); return; }
    setError("That email and password do not match a Bleuprint member account.");
    setBusy(false);
  }
  return <main className="auth-page"><a className="auth-brand" href="/index.html">Bleuprint</a><section className="auth-shell"><div className="auth-intro"><span className="portal-kicker">Private workspace</span><h1>Return to your Bleuprint workspace.</h1><p>One shared system. Individual access for each Bleuprint strategist.</p></div><form className="access-form" onSubmit={signIn}><label htmlFor="email">Member email</label><input id="email" name="email" type="email" autoComplete="email" required /><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />{error ? <p className="access-error" role="alert">{error}</p> : null}<button disabled={busy}>{busy ? "Opening workspace…" : "Enter workspace"}</button><small>Access is limited to Kalena and Paris.</small></form></section></main>;
}
