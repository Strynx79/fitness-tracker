# Agentic Workflow & Architecture Rules

## 1. Role Separation (Orchestrator vs Subagents)
- When operating as a Primary Agent (`Plan` or `Build`), act as the **Lead Orchestrator**. Keep your main context window clean!
- Delegate codebase searches and file discovery to `@explore`.
- Delegate Prisma schema changes and backend Server Actions to `@db-architect`.
- Delegate React components, Tailwind styling, and Recharts pages to `@ui-builder`.
- After every feature slice is built, invoke `@qa-reviewer` to audit the `git diff` and run `npm run typecheck`.

## 2. Engineering Rules
- **Vertical Slices Only:** Never build two slices at once. Finish the Database -> Server Action -> UI -> QA loop for one slice before touching the next.
- **Strict TypeScript:** Never use `any`. Validate all form inputs with Zod.
- **Verification First:** A task is NEVER complete until `npm run typecheck` passes with 0 errors.

## Environment & Filesystem Isolation (WSL Native)
- **Strictly Native Linux:** All commands, services, tools, and dependencies must run 100% inside the native WSL Linux environment (`/home/adwaith/...`).
- **Zero Windows `/mnt/c` Access:** Never reference, inspect, write to, or execute anything from `/mnt/` or `/mnt/c/`. 
- **Tooling:** Always use native Linux binaries (`npm`, `npx`, `docker`, `git`). Never invoke Windows executables (`.exe`, `.cmd`, `.bat`, or PowerShell wrappers).
- **Docker:** Ensure all containers run via native Linux Docker daemon (or Docker Desktop with WSL 2 integration enabled). Never mount Windows host volumes.
