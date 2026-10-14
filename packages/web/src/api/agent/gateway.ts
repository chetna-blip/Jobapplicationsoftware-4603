import { createGateway } from "ai";

export const gateway = createGateway({
  baseURL: process.env.AI_GATEWAY_BASE_URL,
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const MODELS = {
  /** Long-form writing: cover letters, screening answers. */
  writer: "anthropic/claude-sonnet-5",
  /** Cheap, high-volume structured work: match scoring, resume extraction. */
  fast: "openai/gpt-5.4-mini",
} as const;
