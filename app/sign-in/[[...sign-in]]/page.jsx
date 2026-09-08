export default async function SignInPage({ searchParams }) {
  const query = await searchParams;
  const failed = query?.error === "1";
  const next = typeof query?.next === "string" && query.next.startsWith("/") ? query.next : "/admin";
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/index.html">Bleuprint</a>
      <section className="auth-shell">
        <div className="auth-intro">
          <h1>Return to your Bleuprint workspace.</h1>
          <p>Enter the private owner passphrase to continue.</p>
        </div>
        <form className="access-form" action="/api/access" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="passphrase">Owner passphrase</label>
          <input id="passphrase" name="passphrase" type="password" autoComplete="current-password" required autoFocus />
          {failed ? <p className="access-error" role="alert">That passphrase did not match. Try again.</p> : null}
          <button type="submit">Enter the portal</button>
          <small>Your session stays active on this device for 30 days.</small>
        </form>
      </section>
    </main>
  );
}
