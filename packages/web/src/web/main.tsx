// Entry point referenced by index.html — composition only, real bootstrap
// lives in __main.tsx (template-managed).
import { authClient } from "./lib/auth";

// Finish a returning managed sign-in redirect before any route renders.
await authClient.managedAuth.handleRedirect().catch(() => {});

await import("./__main");
