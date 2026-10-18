import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { DEV_USER_ID } from "@/lib/dev-user";

/**
 * The single chokepoint for "who is the current user".
 *
 * There is no auth in the MVP, so this always resolves the seeded dev user.
 * Every server action and page must call this instead of inlining a user id —
 * that way adding Auth.js later is a change to this file alone.
 *
 * `cache` dedupes the lookup within a single request (layout + page + actions).
 */
export const getCurrentUser = cache(async () => {
  const user = await prisma.user.findUnique({ where: { id: DEV_USER_ID } });

  if (!user) {
    throw new Error(
      `Dev user "${DEV_USER_ID}" is missing. Run \`npm run db:seed\`.`,
    );
  }

  return user;
});
