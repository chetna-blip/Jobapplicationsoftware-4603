import { Link } from "wouter";
import { Briefcase } from "lucide-react";
import { Backdrop } from "./shell";

/** Centred single-column frame shared by sign-in and sign-up. */
export function AuthShell({
  eyebrow,
  title,
  sub,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-12">
      <Backdrop />
      <div className="w-full max-w-[420px]">
        <Link to="/" className="rise mb-9 flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="size-4" />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-[-0.03em]">
            Apply<span className="text-primary">Copilot</span>
          </span>
        </Link>

        <div className="rise" style={{ "--d": "60ms" } as React.CSSProperties}>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-[2rem]">{title}</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{sub}</p>
        </div>

        <div className="rise mt-8" style={{ "--d": "120ms" } as React.CSSProperties}>
          {children}
        </div>

        <div
          className="rise mt-7 text-sm text-muted-foreground"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20H24v8h11.3C33.7 33.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20c11 0 19.4-8 19.4-20 0-1.3-.2-2.7-.8-4z"
        transform="scale(.5)"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        transform="scale(.5)"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-2.6-11.3-7l-6.5 5C9.5 39.6 16.2 44 24 44z"
        transform="scale(.5)"
      />
      <path
        fill="#1976D2"
        d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.9 35.6 44 30.3 44 24c0-1.3-.2-2.7-.4-4z"
        transform="scale(.5)"
      />
    </svg>
  );
}
