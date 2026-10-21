---
name: prisma-7-rules
description: Mandatory Prisma 7 ESM, driver adapter, and configuration rules. Load whenever editing prisma.config.ts, schema.prisma, or database client code.
metadata:
  opencode/autoinvoke: "true"
---
## Prisma 7 Strict Rules
1. Generator provider must be `prisma-client` (NOT `prisma-client-js`) with an explicit `output` path[cite: 8].
2. Driver adapter `@prisma/adapter-pg` is mandatory when instantiating `PrismaClient`[cite: 8].
3. `datasource.url` lives in `prisma.config.ts`, NOT inside `schema.prisma`[cite: 8].
4. `prisma migrate dev` does NOT auto-run `prisma generate` or seed scripts—run them explicitly[cite: 8].
5. Keep `prisma` and `@prisma/client` pinned to the exact same version (`7.10.1`)[cite: 8].
