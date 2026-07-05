# @kit/claude

Thin wrapper around the official `@anthropic-ai/sdk`: model comes from
`ANTHROPIC_MODEL` (default `claude-opus-4-8`), a 60s timeout and 3 retries with
exponential backoff are configured on the client, and every call is logged via
[[@kit/logger]] with latency, token counts and estimated cost in USD
(`claude_call` / `claude_call_failed` events). Pass `jsonSchema` to get
guaranteed-valid JSON back via structured outputs. Reuse from any TS project via
a `file:` dependency (`"@kit/claude": "file:../../../kit/ts/claude"`) and, in
Next.js, add `"@kit/claude"` to `transpilePackages`. Usage:
`const r = await callClaude({ system, prompt, jsonSchema }); JSON.parse(r.text)`.
