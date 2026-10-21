---
name: session-handoff
description: Save architectural decisions, discovered traps, and current progress to .opencode/MEMORY.md before clearing context or switching models.
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "true"
---
## Workflow
1. Read `.opencode/MEMORY.md` if it exists (create it if it does not).
2. Check `git status` and `git diff --stat` to verify actual disk state.
3. Update `.opencode/MEMORY.md` concisely (keep total file under 120 lines) under these exact headings:
   - `## Current Slice & Status`
   - `## Pinned Versions & Known Traps`
   - `## Recent Decisions`
   - `## Next Immediate Step`
4. Confirm to the user that `.opencode/MEMORY.md` is updated and it is safe to run `/new` or `/models`.
