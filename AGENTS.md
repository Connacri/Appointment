# AGENTS.md

> Compact operating contract for every coding agent working in this repository.
> Read the linked reference only when the task enters that area. Do not load every
> document or tool integration for routine changes.

## 1. Project context

Appointment is a React + TypeScript + Vite application, packaged for Android with
Capacitor. Local browser storage is primary (IndexedDB); Supabase is an optional,
project-scoped backend/synchronisation service. Confirm the current implementation
in source code and `docs/ARCHITECTURE.md` before changing architecture.

## 2. Blocking safety rules

- Never commit secrets, credentials, tokens, keystores, service-account files or
  populated `.env*` files. Inspect the exact diff before committing.
- Never build/sign production artifacts locally. Production release artifacts are
  produced and verified by GitHub Actions only.
- Never claim tests, CI, deployment, synchronisation or release succeeded without
  checking the actual result.
- Never force-push, rewrite published history, move/delete release tags, or delete
  a published release without explicit approval.
- Ask before changing the Android application ID, signing identity, production
  credentials, user data, database schema in production, or performing an
  irreversible migration/deletion.
- Do not add paid services or remove user-facing functionality without approval.
- Keep public privacy and account-deletion information accurate. Never claim an
  account-deletion or backend operation exists unless the implementation does.

## 3. Engineering rules

1. Inspect the relevant source, architecture, tests and existing conventions first.
2. Make the smallest coherent change; reuse existing services, components and tokens.
3. Avoid dependencies, abstractions, duplicate configuration and generated files
   unless justified by a concrete requirement.
4. Do not hide defects by weakening tests, suppressing errors or using
   `continue-on-error`.
5. Remove dead code only when usage/history confirms it is unused; investigate
   ambiguous cases before deletion.
6. Keep user-visible strings in the i18n system. Supported locales are `fr`,
   `en` and `ar`; preserve key parity and RTL behavior.
7. Report assumptions and distinguish verified results from unverified claims.

## 4. Product and data contracts

- Preserve the offline-first behavior: local data remains usable without a network.
- Treat sync status as evidence-based. Never display “synced” for a queued,
  failed, pending or unverified operation.
- Preserve workspace isolation, idempotency and deletion/tombstone semantics
  wherever the sync implementation uses them. Inspect the current sync code and
  architecture documentation before modifying it.
- Supabase MCP access is project-scoped and read-only by default. Use the
  publishable client key in client code; authorization belongs in database grants
  and Row Level Security. Never place service-role keys in the application.
- Do not invent imported buildings, rooms, reservations or source database values.
  Preserve source data and report incomplete or ambiguous imports.

## 5. UI, accessibility and responsive behavior

**Mandatory UI/UX skill:** Before creating, reviewing, redesigning or modifying any user
interface, read and apply the complete repository skill at
`.agents/skills/ui-ux-design-master/SKILL.md`. This requirement applies to every
coding agent and LLM, regardless of vendor or IDE. Do not rely on a short adapter
file as a substitute for the complete skill. If the canonical skill is unavailable,
state that limitation and follow the rules below.

- Prioritize usability, clarity, accessibility, consistency, responsiveness,
  performance, then visual polish.
- Reuse the existing semantic design tokens; do not create a parallel theme.
- Follow platform conventions, visible keyboard focus, semantic labels, sufficient
  contrast, reduced-motion preferences, and non-color-only status communication.
- Test relevant changes at narrow mobile, tablet and desktop widths, including
  Arabic RTL and long text. Do not fix overflow by blindly hiding it.
- Every data-driven screen must handle loading, success, empty, error and offline
  states where applicable.

## 6. Verification

Run the checks relevant to the changed files. Standard project commands:

```bash
npm run lint
npm run test
npm run i18n:check
npm run build
```

`npm run typecheck` is also available. Do not report a check as passed unless
it was actually run and its exit status was successful. For UI changes, inspect
the rendered result at the affected breakpoints. For release work, verify the
actual GitHub Actions run and published artifacts.

## 7. Git and delivery

- Keep each commit to one logical change. Use Conventional Commits with an
  imperative subject of at most 72 characters.
- Prefer specific file staging; never blindly stage the entire working tree.
- Before committing, inspect status and the complete staged diff for secrets and
  unrelated changes.
- For non-trivial work, use a focused branch/PR when review is requested. Do not
  force-push to `main`.
- Final report: **Changed · Checks run and results · CI/deployment verified or
  not verified · Risks/limitations · Follow-up**. Include links when available.

## 8. Reference map — load on demand

| Task | Source of truth |
|---|---|
| Application structure and data flow | `docs/ARCHITECTURE.md` |
| Locales, translation keys and RTL | `docs/I18N.md`, `src/i18n/translations.ts` |
| Data inventory, privacy and deletion behavior | `docs/COMPLIANCE.md` |
| Release process and artifacts | `docs/RELEASE.md`, `.github/workflows/release-and-deploy.yml` |
| Owner-managed secrets and variables | `docs/ci/OWNER-BOOTSTRAP.md`, `scripts/bootstrap-secrets.sh` |
| Supabase MCP connection and permissions | `docs/SUPABASE_MCP.md`, `.mcp.json` |
| Optional future quality jobs | `docs/ci/QUALITY-ADVANCED.md` |

Do not inline these documents into this file. Open only the reference relevant to
the current task. Optional/future quality jobs are not current release gates
unless a workflow actually enables them.
