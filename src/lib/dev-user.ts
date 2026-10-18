/**
 * The single source of truth for "which user owns this row".
 *
 * The MVP has no auth: every table is owned via `userId`, but only one user
 * exists. `getCurrentUser()` resolves to this account. When Auth.js is added
 * later, only `auth.ts` changes — nothing else in the app hardcodes this id.
 */
export const DEV_USER_ID = "usr_local_dev";
