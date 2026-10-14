import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { authClient } from "../lib/auth";
import { AuthShell, GoogleMark } from "../components/auth-shell";
import { ErrorNote, Spinner } from "../components/bits";

function SignUp() {
  const { data: session, isPending } = authClient.useSession();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && session) return <Redirect to="/jobs" />;

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const res = await authClient.signUp.email({ name, email, password });
    setBusy(null);
    if (res.error) setError(res.error.message ?? "Could not create the account.");
    else navigate("/onboarding");
  }

  async function withGoogle() {
    setError(null);
    setBusy("google");
    const res = await authClient.managedAuth.signIn({ provider: "google" });
    setBusy(null);
    if (res.error && res.error.code !== "POPUP_CLOSED") {
      setError(res.error.message ?? "Google sign-in failed.");
    } else if (!res.error) {
      navigate("/onboarding");
    }
  }

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      sub="Upload a resume once. Every application after that gets written for you."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="text-info underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={busy !== null}
          onClick={withGoogle}
        >
          {busy === "google" ? <Spinner /> : <GoogleMark />} Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={withEmail} className="space-y-3">
          <input
            className="field"
            required
            autoComplete="name"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field"
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
            {busy === "email" ? <Spinner /> : null} Create account
          </Button>
        </form>

        <ErrorNote error={error} />
      </div>
    </AuthShell>
  );
}

export default SignUp;
