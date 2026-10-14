# Apply Copilot — Design

An AI job-application copilot (web only). It aggregates fresh listings from public ATS boards
(Greenhouse + Lever), scores each one against the user's own profile (resume, links, onboarding
answers), writes the whole application for the user (tailored cover letter + an answer to every
real screening question the posting publishes), and then **auto-fills the live apply form** in the
user's own browser through a one-click bookmarklet — the user just presses Submit.

**Why not fully silent submission:** verified against both boards. Lever's public apply endpoint
answers `403 {"ok":false,"error":"You need an API key. Please contact support@lever.co for a key"}`,
and Greenhouse's application endpoint needs the employer's private per-company key. No third party
can submit to these boards on a candidate's behalf. Driving a headless browser through LinkedIn or
Indeed logins is against their terms and is actively blocked. So the last click stays with the
human — everything before it is automated.

**Two autofill limits found by testing the runner against live forms, and how each is handled:**

1. *Company-hosted Greenhouse pages put the form in a cross-origin iframe.* Greenhouse's
   `/<token>/jobs/<id>` URL 302s to the employer's own careers site for companies that host their
   own page (Stripe, for one), where the real form lives in an iframe a bookmarklet in the top
   frame cannot reach — 0 reachable inputs. Fix: `scrape.ts` stores the
   `job-boards.greenhouse.io/embed/job_app?for=<token>&token=<id>` URL, which serves that same
   form standalone at the top level. Verified: 30 reachable inputs, 15 filled.
2. *Searchable (react-select) dropdowns cannot be set by a script at all.* Their menu state is
   driven by trusted keystrokes, so synthetic events write visible text that never commits — the
   field looks filled and submits empty, which is worse than leaving it alone. The runner detects
   these, skips them, and names them in its status bar for the user to pick. Confirmed
   unfixable from a bookmarklet: native setter + `input`/`change`/`keydown Enter` all fail to
   commit a selection.

Greenhouse also hides its Cover Letter textarea behind an "Enter manually" toggle; the runner
presses that first, then fills on the next tick once React has rendered the field.

**Lever's screening questions are not in its API.** The public Postings API returns only content
(`lists`, `description`, `additional`, `hostedUrl`, `applyUrl`) — no questions, so early drafts for
Lever jobs answered nothing and the runner filled identity fields only. The questions exist solely
in the rendered apply page as `<li class="application-question custom-question">` blocks whose
inputs are named `cards[<cardId>][fieldN]`. `hydrateJob` now fetches that page for Lever jobs and
parses them, and because the parsed name is the real form name, every answer matches exactly.
Verified live on a Tala posting: 4 real questions ("What got you interested in joining Tala?",
notice period, compensation expectations, referral) drafted and filled, 11 of 11 fields.
Demographic blocks (`eeo[...]`, `surveysResponses[...]`) are deliberately *not* parsed — that is
voluntary personal data for the candidate to answer, never an AI.

Two smaller consequences of boards disagreeing on shape, both handled in the payload:

- Fields are marked `alias` when they are one of several shapes for the same thing (Lever's single
  "Full name" vs Greenhouse's first + last; the optional "Additional information" box). An
  unmatched alias is normal, so it is not reported back as work left to do.
- Unmatched fields are judged only after the whole pass, and one is treated as done if a box we
  did write is the same question or already holds that value — otherwise a posting that asks for a
  portfolio link in its own words got reported as missing right after we filled it.
- Many Lever postings have no cover-letter box at all. Rather than dropping the drafted letter
  silently, the runner says so and puts the letter on the clipboard, claiming that only once the
  write actually resolves.

Visual direction: **editorial dark control-room**. Near-black ink background, warm bone text, a
single acid-lime accent used only for action and score, thin hairline borders, dense-but-airy
tabular layouts. Feels like a professional trading terminal, not a SaaS dashboard.

## Brand & Colors

Tokens in `packages/web/src/web/styles.css` (web + desktop). Dark is the only theme.

| Token | Value | Use |
|-------|-------|-----|
| background | `#0B0C0B` | Page background |
| surface / card | `#131513` | Cards, panels, rows |
| surface-2 | `#1B1E1B` | Hover, inputs, chips |
| foreground | `#F2EFE6` | Primary text (bone) |
| muted-foreground | `#8B8F86` | Secondary text, labels |
| border | `#262A26` | Hairlines |
| primary (lime) | `#C8FF4D` | Buttons, active state, match score |
| primary-foreground | `#0B0C0B` | Text on lime |
| accent-amber | `#F0B429` | "Ready to submit" status |
| accent-blue | `#6FA8FF` | Links, info |
| destructive | `#FF6B5E` | Errors, failed submissions |

Score ramp: 85+ lime, 70–84 bone, <70 muted.

## Typography

- **Display**: `Bricolage Grotesque` (700/800) — page titles, job titles, numbers.
- **Body / UI**: `Poppins` (400/500/600).
- **Mono**: `JetBrains Mono` — scores, timestamps, source tags, IDs.

Loaded from Google Fonts in `index.html`. Tight display tracking (`-0.03em`), generous body
line-height (1.65).

## Layout

- Fixed left rail nav (icon + label, 220px) on desktop; top bar on mobile.
- Content max-width 1180px, 32px gutters, 1px hairline dividers instead of card shadows.
- Job feed is a list of full-width rows (not a card grid): title + company left, match score right,
  meta line beneath. Row expands to a detail drawer.
- Onboarding is a single-column 560px wizard with a step ticker.
- Motion: staggered fade-up on page load via `motion`, 200ms hover transitions. Nothing bouncy.

## Pages

- **Landing** (`pages/index.tsx`) — pitch + sign-in CTA for signed-out users; redirects to `/jobs`
  when signed in.
- **Sign in / Sign up** (`pages/sign-in.tsx`, `pages/sign-up.tsx`) — email/password + Google (Runable
  managed auth).
- **Onboarding** (`pages/onboarding.tsx`) — 4 steps: resume upload → links → target roles/locations →
  application facts (work auth, salary, notice, experience). AI builds a profile summary.
- **Jobs** (`pages/jobs.tsx`) — matched feed, filters (source, remote, min score, search), refresh.
- **Job detail** (`pages/job.tsx`) — full description, match reasoning, generated cover letter and
  per-question answers, Auto-apply / Review & submit.
- **Applications** (`pages/applications.tsx`) — tracker table with status, method, date, sent payload.
- **Profile** (`pages/profile.tsx`) — edit everything collected in onboarding, re-upload resume.

## Key Flows

1. **Sign up → onboarding** → resume parsed (`unpdf`) + links fetched → AI extracts skills, titles,
   summary → suggested target roles prefilled from the resume, user confirms/edits.
2. **Feed** → server scrapes 47 Greenhouse/Lever boards daily (33 + 14, all verified live) → AI scores unscored jobs against the
   profile in batches → feed sorted by score.
3. **Apply** → AI writes a tailored cover letter + answers the posting's real custom questions
   (option questions matched verbatim against the published choices) → status `needs_review` →
   user clicks **Autofill & open**: the apply page opens and the bookmarklet writes every value into
   the real form (matching by field name first, visible label second, through React's own value
   setter). User attaches the resume file, checks it, presses the page's own Submit, then marks it
   submitted in the tracker.

## Architecture

- API: oRPC in `packages/web/src/api/routes/` — `profile`, `jobs`, `applications`.
- Autofill: `src/api/lib/autofill.ts` builds the field/value payload and the bookmarklet runner.
- Scraper: `src/api/lib/sources.ts` (board list) + `src/api/lib/scrape.ts`; daily refresh scheduled in
  `src/api/lib/scheduler.ts`, plus manual refresh mutation.
- AI: `src/api/agent/` — profile extraction, match scoring, application answer generation
  (`anthropic/claude-sonnet-5` for writing, `openai/gpt-5.4-mini` for scoring).
- Auth: Better Auth + Runable managed auth (Google) — email/password too.
- Storage: resumes in Tigris via presigned PUT.
