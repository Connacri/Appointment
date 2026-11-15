# GitHub Copilot — repository agent instructions

Apply this instruction to Copilot Chat and coding-agent tasks in this repository. Preserve all project safety and engineering constraints.

For every task that creates, edits, reviews, audits, redesigns, or implements a user
interface, first read the complete skill:

`.agents/skills/ui-ux-design-master/SKILL.md`

Apply its methodology, responsive/mobile doctrine, accessibility requirements,
design-system constraints, platform conventions, RTL/i18n rules, and delivery
checklist. Do not merely summarize the skill or replace it with generic design
advice. If the file cannot be accessed, report that limitation rather than
pretending the skill was loaded.

This repository-level pointer is intentionally short. The canonical skill is the
single source of truth; do not fork or silently rewrite its rules in this file.

## Data contract — mandatory

For every task involving domain data, IndexedDB, PostgreSQL/Supabase, repositories,
imports, synchronization or data-driven UI, read and follow `docs/DATA_CONTRACT.md`
in full. Trace and validate business rules, domain types, local schema/upgrades, remote
schema/migrations, generated database types, constraints, RLS, repositories, UI and tests
together. Update the contract status and add regression tests in the same change set.
Never claim alignment from TypeScript compilation alone. Do not invent hotels,
establishments, floors, rooms or workspaces. If remote schema history or a safe test
environment is unavailable, do not guess or apply speculative production DDL; report
the blocker.
