/**
 * Public ATS job boards we aggregate from.
 *
 * Both Greenhouse's Job Board API and Lever's Postings API are public, key-free reads:
 *   greenhouse: https://boards-api.greenhouse.io/v1/boards/<token>/jobs
 *   lever:      https://api.lever.co/v0/postings/<token>?mode=json
 *
 * Every token below was verified to return live postings. Add more freely — the scraper
 * skips boards that fail.
 */
export type BoardSource = "greenhouse" | "lever";

export interface Board {
  source: BoardSource;
  token: string;
  company: string;
  category: string;
}

export const BOARDS: Board[] = [
  // ——— Greenhouse ———
  { source: "greenhouse", token: "stripe", company: "Stripe", category: "Fintech" },
  { source: "greenhouse", token: "airbnb", company: "Airbnb", category: "Travel" },
  { source: "greenhouse", token: "databricks", company: "Databricks", category: "Data & AI" },
  { source: "greenhouse", token: "robinhood", company: "Robinhood", category: "Fintech" },
  { source: "greenhouse", token: "figma", company: "Figma", category: "Design tools" },
  { source: "greenhouse", token: "dropbox", company: "Dropbox", category: "Software" },
  { source: "greenhouse", token: "coinbase", company: "Coinbase", category: "Crypto" },
  { source: "greenhouse", token: "brex", company: "Brex", category: "Fintech" },
  { source: "greenhouse", token: "asana", company: "Asana", category: "Software" },
  { source: "greenhouse", token: "instacart", company: "Instacart", category: "Marketplace" },
  { source: "greenhouse", token: "affirm", company: "Affirm", category: "Fintech" },
  { source: "greenhouse", token: "twilio", company: "Twilio", category: "Software" },
  { source: "greenhouse", token: "gitlab", company: "GitLab", category: "Developer tools" },
  { source: "greenhouse", token: "reddit", company: "Reddit", category: "Media" },
  { source: "greenhouse", token: "discord", company: "Discord", category: "Consumer" },
  { source: "greenhouse", token: "duolingo", company: "Duolingo", category: "Education" },
  { source: "greenhouse", token: "lyft", company: "Lyft", category: "Mobility" },
  { source: "greenhouse", token: "pinterest", company: "Pinterest", category: "Media" },
  { source: "greenhouse", token: "flexport", company: "Flexport", category: "Logistics" },
  { source: "greenhouse", token: "samsara", company: "Samsara", category: "IoT" },
  { source: "greenhouse", token: "anthropic", company: "Anthropic", category: "Data & AI" },
  { source: "greenhouse", token: "scaleai", company: "Scale AI", category: "Data & AI" },
  { source: "greenhouse", token: "betterment", company: "Betterment", category: "Fintech" },
  { source: "greenhouse", token: "chime", company: "Chime", category: "Fintech" },
  { source: "greenhouse", token: "carta", company: "Carta", category: "Fintech" },
  { source: "greenhouse", token: "sofi", company: "SoFi", category: "Fintech" },
  { source: "greenhouse", token: "peloton", company: "Peloton", category: "Consumer" },
  { source: "greenhouse", token: "sweetgreen", company: "Sweetgreen", category: "Food & retail" },
  { source: "greenhouse", token: "hellofresh", company: "HelloFresh", category: "Food & retail" },
  { source: "greenhouse", token: "buzzfeed", company: "BuzzFeed", category: "Media" },
  { source: "greenhouse", token: "webflow", company: "Webflow", category: "Software" },
  { source: "greenhouse", token: "airtable", company: "Airtable", category: "Software" },
  { source: "greenhouse", token: "vercel", company: "Vercel", category: "Developer tools" },

  // ——— Lever ———
  { source: "lever", token: "spotify", company: "Spotify", category: "Media" },
  { source: "lever", token: "palantir", company: "Palantir", category: "Data & AI" },
  { source: "lever", token: "shieldai", company: "Shield AI", category: "Defense" },
  { source: "lever", token: "veeva", company: "Veeva Systems", category: "Healthcare" },
  { source: "lever", token: "gopuff", company: "Gopuff", category: "Food & retail" },
  { source: "lever", token: "zoox", company: "Zoox", category: "Mobility" },
  { source: "lever", token: "matchgroup", company: "Match Group", category: "Consumer" },
  { source: "lever", token: "binance", company: "Binance", category: "Crypto" },
  { source: "lever", token: "crypto", company: "Crypto.com", category: "Crypto" },
  { source: "lever", token: "olo", company: "Olo", category: "Food & retail" },
  { source: "lever", token: "toptal", company: "Toptal", category: "Marketplace" },
  { source: "lever", token: "tala", company: "Tala", category: "Fintech" },
  { source: "lever", token: "kavak", company: "Kavak", category: "Marketplace" },
  { source: "lever", token: "plexus", company: "Plexus", category: "Legal" },
];

/** Cap per board so one huge board can't dominate the feed. */
export const MAX_JOBS_PER_BOARD = 120;
