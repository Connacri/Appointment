# Supabase MCP — Appointment

This repository includes a project-scoped Supabase MCP configuration for coding agents.

## Default connection

The root `.mcp.json` connects to the hosted Supabase MCP server:

- Project: `Appointment`
- Project ref: `vkmgakmujipnpjlawjqm`
- Transport: HTTP / hosted OAuth
- Access mode: read-only by default
- Enabled groups: Database, Debugging, Development, Docs and Edge Functions
- Storage and account-wide project management are not enabled

The URL is intentionally scoped to this project. Do not remove `project_ref` or enable account-wide access for convenience.

Read-only is the safe default for a production-linked project. It lets an agent inspect tables, migrations, logs, advisors, project URL, publishable keys and generated types without allowing SQL writes or schema changes through MCP.

If a task explicitly requires a database write, migration, Edge Function deployment or another mutation, request the owner's approval first and use a separately reviewed, temporary write-enabled MCP connection. Do not commit personal access tokens, OAuth tokens, service-role keys or other credentials in this repository.

## Connect ChatGPT

The repository configuration does not automatically register a connector in a ChatGPT account. To connect ChatGPT:

1. Open **Settings → Connectors**.
2. Enable developer mode if required by the account.
3. Add a custom connector using this URL:

```text
https://mcp.supabase.com/mcp?project_ref=vkmgakmujipnpjlawjqm&read_only=true&features=database%2Cdebugging%2Cdevelopment%2Cdocs%2Cfunctions
```

4. Complete Supabase's browser-based OAuth flow and authorize access to the organization containing the Appointment project.

Review the requested permissions before authorizing. Never provide a service-role key or database password to ChatGPT.

## Optional Supabase Agent Skills

Supabase's coding-agent instructions can be installed separately in a local development environment:

```bash
npx skills add supabase/agent-skills
```

This is optional and is not run automatically by the application, CI, or this repository's MCP configuration. If already installed, update with:

```bash
npx skills update
```

Official references:

- [Supabase MCP setup and security](https://supabase.com/docs/guides/ai-tools/mcp)
- [Supabase Agent Skills](https://github.com/supabase/agent-skills)
