import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/index.html">Bleuprint</a>
      <section className="auth-shell">
        <div className="auth-intro">
          <h1>Enter the Bleuprint workspace.</h1>
          <p>Accept your invitation using the approved email address.</p>
        </div>
        <SignUp path="/sign-up" routing="path" forceRedirectUrl="/admin" appearance={{ variables: { colorPrimary: "#06553C", colorText: "#121915", colorBackground: "#F7F8F6", borderRadius: "18px", fontFamily: "DM Sans, system-ui, sans-serif" } }} />
      </section>
    </main>
  );
}
