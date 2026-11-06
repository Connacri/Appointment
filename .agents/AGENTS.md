# Appointment — Google AI Studio / Antigravity agent instructions

This file is the entry point for agents that automatically load `.agents/AGENTS.md`.

1. Read the repository-root `AGENTS.md` before inspecting or changing project files. It is the canonical engineering, safety, architecture, verification and delivery contract.
2. Before creating, reviewing, redesigning or modifying any UI, read the complete skill at `.agents/skills/ui-ux-design-master/SKILL.md`. Apply its full methodology and responsive/mobile, accessibility, RTL and design-system requirements; do not rely on a summary.
3. Treat repository files and existing implementation as the source of truth. Inspect relevant code and tests before proposing changes.
4. Preserve offline-first behavior, workspace isolation, data integrity and evidence-based sync status as specified in the root `AGENTS.md`.
5. Do not claim that code, tests, CI, deployment or synchronization succeeded unless you actually verified the result.
6. Keep changes minimal, scoped and consistent with existing architecture. Never commit secrets or weaken tests to conceal failures.

If the root instructions or UI/UX skill cannot be accessed, stop before making a potentially consequential change and report exactly what is unavailable.
