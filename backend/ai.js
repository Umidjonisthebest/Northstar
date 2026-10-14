// Optional Claude connection for Nova, the study tutor.
//
// Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in backend/.env to turn it
// on; without it Nova answers from the built-in tutor in tutor.js. TUTOR_MODEL
// and TUTOR_EFFORT override the defaults below.

import Anthropic from "@anthropic-ai/sdk";
import { aiLimits } from "./aiLimits.js";

const MODEL = process.env.TUTOR_MODEL || "claude-opus-5";
// Tutoring is latency-sensitive chat; medium effort keeps replies quick while
// thinking stays on. Raise it with TUTOR_EFFORT=high if answers need more depth.
const EFFORT = process.env.TUTOR_EFFORT || "medium";

let client = null;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient() {
  if (!client) client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  return client;
}

// Streams a reply. `onText` receives text deltas as they arrive. Resolves to
// { text, refused } once the message is complete; rejects on API/network errors
// so the caller can fall back to the built-in tutor.
export async function streamReply({ system, messages, onText, signal }) {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      // Nova's replies are a few sentences. A low ceiling (TUTOR_MAX_TOKENS, default 1500, which
      // also has to cover the model's thinking) keeps one reply's cost bounded.
      max_tokens: aiLimits().maxTokens,
      system,
      messages,
      output_config: { effort: EFFORT },
      // Cache the system prompt + conversation so follow-up turns about the same
      // question reuse the prefix.
      cache_control: { type: "ephemeral" },
      // If the model declines, retry server-side on Anthropic's recommended fallback.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default"
    },
    { signal }
  );
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  return { text, refused: final.stop_reason === "refusal" };
}
