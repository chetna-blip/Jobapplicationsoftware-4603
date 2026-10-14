import { needsScrape, runScrape, deactivateStale } from "./scrape";

let started = false;

/**
 * Daily listing refresh. The web process is long-lived, so an interval is enough —
 * it also self-heals on restart by checking when the last completed run was.
 */
export function startScheduler() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      if (await needsScrape(24)) {
        console.log("[scheduler] refreshing job listings…");
        const result = await runScrape();
        await deactivateStale(30);
        console.log("[scheduler] refresh done", result);
      }
    } catch (err) {
      console.warn("[scheduler] refresh failed:", (err as Error).message);
    }
  };

  // first check shortly after boot, then every hour (the 24h guard decides if work happens)
  setTimeout(tick, 15_000);
  setInterval(tick, 3600_000);
}
