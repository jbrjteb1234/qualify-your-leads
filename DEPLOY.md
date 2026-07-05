# DEPLOY.md — public repo & deployment runbook

The public repo is **github.com/jbrjteb1234/qualify-your-leads**. Supabase,
Anthropic, HubSpot and Slack are external services reached over their APIs —
the app itself is a single Next.js service.

## Hosting (not yet connected)

Not deployed yet. Two proven options:

- **Railway** (how P2's `ask-your-docs` is hosted): add a Dockerfile, connect
  the repo, every push to `main` auto-deploys. Needs a Next.js standalone
  Dockerfile — small task, not yet written.
- **Vercel**: import the repo (framework auto-detected, no Dockerfile
  needed) and set the environment variables below.

Environment variables for either host (fill from your local `.env.local`;
never commit them):

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your Supabase secret key>
ANTHROPIC_API_KEY=<your Anthropic key>
ANTHROPIC_MODEL=claude-opus-4-8
APP_URL=https://<your deployed URL>
# optional integrations — skipped gracefully when unset:
HUBSPOT_ACCESS_TOKEN=<private app token>
SLACK_WEBHOOK_URL=<incoming webhook URL>
```

After first deploy: run `supabase/schema.sql` in the Supabase project (if not
already run), `npm run seed:reset` from a machine with the keys to load demo
data, and smoke-test `/`, `/leads` and `/queue`.

## Updating the app (monorepo → public repo)

The canonical source is the private monorepo at
`projects/p1-lead-qualifier/app`. The shared kit is vendored into `./vendor`
so the app builds standalone; the canonical kit is `/kit/ts`. After changing
either, re-sync and publish:

```
# from the monorepo root, after committing your changes
git subtree split --prefix=projects/p1-lead-qualifier/app -b p1-deploy
git push deploy-p1 p1-deploy:main     # 'deploy-p1' = the qualify-your-leads remote
git branch -D p1-deploy               # tidy the temp split branch
```

If the kit changed, first re-copy `/kit/ts/logger` and `/kit/ts/claude` into
`./vendor/kit-logger` and `./vendor/kit-claude` (package.json + README.md +
src/ only; keep the `file:../kit-logger` dep path in vendor/kit-claude) and
commit, then run the sync above.
