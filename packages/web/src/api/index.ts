import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { ping } from "./routes/ping";
import { profile } from "./routes/profile";
import { jobs } from "./routes/jobs";
import { applications } from "./routes/applications";
import { auth } from "./auth";
import { startScheduler } from "./lib/scheduler";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
export const router = {
  ping,
  profile,
  jobs,
  applications,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

// Better Auth (managed Google + email/password)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Daily listing refresh — guarded so a restart never double-scrapes.
startScheduler();

export default app;
