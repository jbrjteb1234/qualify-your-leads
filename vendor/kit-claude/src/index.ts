import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@kit/logger";

const log = createLogger("kit.claude");

// USD per million tokens; extend as models are added. Unknown models log cost_usd: null.
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 2048;
const TIMEOUT_MS = 60_000;
// The SDK retries 429/5xx/connection errors with exponential backoff.
const MAX_RETRIES = 3;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }
  return client;
}

export interface ClaudeCallOptions {
  prompt: string;
  system?: string;
  maxTokens?: number;
  /** JSON Schema for structured output — the response text is guaranteed valid JSON matching it. */
  jsonSchema?: Record<string, unknown>;
}

export interface ClaudeCallResult {
  text: string;
  stopReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/**
 * Builds the exact request params callClaude would send — exported so dry-run
 * previews are guaranteed identical to the real request. Needs no API key.
 */
export function buildRequestParams(
  opts: ClaudeCallOptions
): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: [{ role: "user", content: opts.prompt }],
  };
  if (opts.system) params.system = opts.system;
  if (opts.jsonSchema) {
    params.output_config = {
      format: { type: "json_schema", schema: opts.jsonSchema },
    };
  }
  return params;
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const params = buildRequestParams(opts);
  const model = params.model;
  const started = Date.now();
  try {
    const response = await getClient().messages.create(params);

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const { input_tokens, output_tokens } = response.usage;
    const price = PRICES_PER_MTOK[model];
    const costUsd = price
      ? (input_tokens * price.input + output_tokens * price.output) / 1_000_000
      : null;

    log.info("claude_call", {
      model,
      ms: Date.now() - started,
      input_tokens,
      output_tokens,
      cost_usd: costUsd,
      stop_reason: response.stop_reason,
    });

    return {
      text,
      stopReason: response.stop_reason,
      model,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd,
    };
  } catch (err) {
    log.error("claude_call_failed", {
      model,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
