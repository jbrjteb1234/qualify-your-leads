# @kit/logger

Zero-dependency structured logger emitting one JSON object per line (timestamp,
level, component, event, plus any payload) — info/debug to stdout, warn/error to
stderr, so hosted platforms (Vercel, Railway) can filter and search them. Reuse
from any TS project via a `file:` dependency
(`"@kit/logger": "file:../../../kit/ts/logger"`) and, in Next.js, add
`"@kit/logger"` to `transpilePackages`. Usage:
`const log = createLogger("api.leads"); log.info("received", { lead_id })`.
