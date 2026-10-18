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
