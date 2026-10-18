import "dotenv/config";

import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Datasource is set only when DATABASE_URL exists. The `env()` helper throws
  // at config-load time when a variable is missing, which would abort the CLI —
  // and because `postinstall` runs `prisma generate`, a fresh clone with no
  // .env yet would fail `npm install` outright. Commands that actually need the
  // database report a clear error of their own.
  ...(url ? { datasource: { url } } : {}),
});
