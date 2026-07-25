import { z } from "zod";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const idSchema = z.string().uuid();

/**
 * Single source of truth for the dashboard session cookie's name, shared
 * between apps/api (issues + verifies it, modules/auth/session.ts) and
 * apps/dashboard (forwards it from the browser to the API on server
 * actions) so the two can't drift out of sync.
 */
export const SESSION_COOKIE_NAME = "envello_session";

/**
 * Dashboard-only (the API never reads this one) - stores the Topbar's
 * Production|Test toggle (see components/shell/topbar.tsx's EnvSwitch) so
 * a server component (the Overview page) and separate client components
 * (Topbar, the Logs page) can all agree on the current selection without a
 * shared React context spanning the dashboard layout and its page content
 * (they're siblings, not parent/child - see (dashboard)/layout.tsx).
 * Kept alongside SESSION_COOKIE_NAME as the one place dashboard cookie
 * names live, even though this one is dashboard-internal.
 */
export const SEND_ENVIRONMENT_COOKIE_NAME = "envello_send_env";
