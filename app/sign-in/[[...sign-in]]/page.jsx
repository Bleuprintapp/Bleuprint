import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/index.html">Bleuprint</a>
      <section className="auth-shell">
        <div className="auth-intro">
          <h1>Return to your Bleuprint workspace.</h1>
          <p>Sign in with your approved Bleuprint member email.</p>
        </div>
        <SignIn path="/sign-in" routing="path" forceRedirectUrl="/admin" appearance={{ variables: { colorPrimary: "#06553C", colorText: "#121915", colorBackground: "#F7F8F6", borderRadius: "18px", fontFamily: "DM Sans, system-ui, sans-serif" } }} />
      </section>
    </main>
  );
}
