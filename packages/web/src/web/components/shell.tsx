import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { Briefcase, FileStack, Menu, Radar, Settings2, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "../lib/auth";
import { useProfile } from "../queries/profile";
import { Loading } from "./bits";

const NAV = [
  { href: "/jobs", label: "Job feed", icon: Radar },
  { href: "/applications", label: "Applications", icon: FileStack },
  { href: "/profile", label: "Profile", icon: Settings2 },
];

export function Backdrop() {
  return (
    <>
      <div className="backdrop-mesh" aria-hidden />
      <div className="backdrop-grain" aria-hidden />
    </>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/jobs" className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Briefcase className="size-4" />
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-extrabold tracking-[-0.03em]">
          Apply<span className="text-primary">Copilot</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
            )}
          >
            <item.icon className={cn("size-4", active && "text-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFoot() {
  const { data: session } = authClient.useSession();
  if (!session?.user) return null;
  return (
    <div className="border-t border-border px-3 py-4">
      <p className="truncate text-sm text-foreground">{session.user.name || "Signed in"}</p>
      <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
      <button
        type="button"
        onClick={() => authClient.signOut().then(() => (window.location.href = "/"))}
        className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-destructive"
      >
        <LogOut className="size-3" /> Sign out
      </button>
    </div>
  );
}

/** Signed-in app chrome: fixed left rail on desktop, sheet on mobile. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col justify-between border-r border-border bg-background/80 backdrop-blur-sm lg:flex">
        <div>
          <div className="px-5 py-6">
            <Wordmark />
          </div>
          <div className="px-2">
            <NavLinks />
          </div>
        </div>
        <UserFoot />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-5 py-3.5 backdrop-blur-sm lg:hidden">
        <Wordmark />
        <button type="button" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[57px] z-30 border-b border-border bg-background px-3 py-3 lg:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
          <UserFoot />
        </div>
      )}

      <main className="lg:pl-[220px]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}

/** Requires a session, and pushes users through onboarding before anything else. */
export function Protected({
  children,
  allowIncomplete = false,
  bare = false,
}: {
  children: React.ReactNode;
  allowIncomplete?: boolean;
  /** Skip the nav chrome — used by the onboarding wizard. */
  bare?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const profile = useProfile();

  if (isPending) return <Gate />;
  if (!session) return <Redirect to="/sign-in" />;
  if (!allowIncomplete) {
    if (profile.isLoading) return <Gate />;
    if (profile.data && !profile.data.onboardingComplete) return <Redirect to="/onboarding" />;
  }
  if (bare) {
    return (
      <div className="min-h-dvh">
        <Backdrop />
        {children}
      </div>
    );
  }
  return <Shell>{children}</Shell>;
}

function Gate() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Backdrop />
      <Loading label="Loading" />
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-[clamp(1.85rem,3.6vw,2.6rem)]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2.5">{right}</div>}
    </div>
  );
}
