# Claude Code MCP setup for Flitrr

This repo ships a project-scoped `.mcp.json` (committed, at repo root) plus two
global tool servers you add once per machine. MCP servers run in your **local**
Claude Code, not in the web/remote container — so these are set up on your own
machine. When you open this repo in Claude Code you'll be prompted to approve
the project servers; approve them once.

## Project-scoped servers (already in `.mcp.json`)

No secrets are committed — the file references environment variables that you
set locally.

### Supabase (read-only, dev project)

Inspect schema, verify RLS, draft/check migrations, generate types. Runs
**read-only** by default — it cannot mutate data. Point it at a **dev**
project, not production, because PULSE holds financial and risk data behind RLS.

Set these in your shell (e.g. `~/.zshrc`) or your machine's env:

```bash
export SUPABASE_PROJECT_REF="your-dev-project-ref"      # Settings → General
export SUPABASE_ACCESS_TOKEN="sbp_xxx"                  # a scoped Personal Access Token
```

To let Claude actually apply migrations, drop `--read-only` from the `args` in
`.mcp.json` — do this deliberately and only against the dev project.

### Vercel (hosted, OAuth)

Deployment status, build logs, env-var inspection. No token in the file — it
authenticates via OAuth in the browser on first use. Run `/mcp` in Claude Code
to complete the Vercel sign-in.

## Global tool servers (add once, reused across all projects)

These are stateless tools with no project secrets, so install them at user
scope:

```bash
# Browser automation — load pages, exercise the signup/login/dashboard flows,
# screenshot, read console errors.
claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest

# Up-to-date library docs (Next.js 14 App Router, @supabase/ssr, etc.)
# injected on demand to avoid stale-API hallucinations.
claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp
```

## Verify

```bash
claude mcp list      # shows configured servers and scope
# or, inside a Claude Code session:
/mcp                 # status + OAuth sign-in for hosted servers
```

## Security notes

- Keep the Supabase MCP read-only and pointed at a dev project unless you have a
  specific reason to do otherwise.
- The `SUPABASE_ACCESS_TOKEN` is a personal access token — scope it minimally
  and never commit it. `.mcp.json` only contains the `${VAR}` references.
- Treat MCP servers as code that runs with your permissions; only approve the
  ones in this file.
