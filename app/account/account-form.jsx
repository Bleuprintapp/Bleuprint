"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountForm({ member }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function changePassword(event) {
    event.preventDefault(); setMessage("Saving…");
    const data = new FormData(event.currentTarget);
    if (data.get("newPassword") !== data.get("confirmPassword")) { setMessage("The new passwords do not match."); return; }
    const response = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
    if (!response.ok) { setMessage("The current password was not accepted."); return; }
    event.currentTarget.reset(); setMessage("Password updated.");
  }
  async function signOut() { await fetch("/api/session", { method: "DELETE" }); router.push("/sign-in"); router.refresh(); }
  return <main className="auth-page"><a className="auth-brand" href="/admin">Bleuprint</a><section className="auth-shell"><div className="auth-intro"><span className="portal-kicker">Member access</span><h1>{member.name}'s account.</h1><p>{member.email}<br />Change your private password whenever you want.</p><button className="text-action" onClick={signOut}>Sign out</button></div><form className="access-form" onSubmit={changePassword}><label htmlFor="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /><label htmlFor="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength="12" required /><label htmlFor="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength="12" required /><button>Change password</button>{message ? <p className="access-message" role="status">{message}</p> : null}</form></section></main>;
}
