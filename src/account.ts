// Owned by: Agent 1 (Auth & dashboard shell).
// See stories/SPRINT-full-backlog-5day-10person.md, Track 1 (D1, E1).
import { z } from "zod";

// --- E1: signup vetting -----------------------------------------------
//
// Static blocklist of disposable/temporary email domains checked at signup.
// Small, sprint-sized list, not exhaustive, but catches the obvious cases
// that would let someone spin up throwaway accounts to abuse shared SES
// sending reputation.
export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "getnada.com",
  "trashmail.com",
  "sharklasers.com",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "mintemail.com",
  "mailnesia.com",
  "moakt.com",
] as const;

// Verticals Envello does not support at launch. Selecting one of these
// blocks signup with a clear error rather than a silent reject (E1).
export const BLOCKED_VERTICALS = [
  "adult-content",
  "gambling",
  "cryptocurrency-icos",
  "unlicensed-pharmaceuticals",
  "weapons-ammunition",
  "multi-level-marketing",
  "payday-lending",
] as const;

// Verticals we do support, shown alongside the blocked list in the signup
// form so the declaration reads as "pick your category" rather than a
// suspicious "are you doing something illegal" prompt.
export const ALLOWED_VERTICALS = [
  "saas",
  "ecommerce",
  "marketplace",
  "media-publishing",
  "fintech-licensed",
  "healthcare-licensed",
  "other",
] as const;

export const VERTICALS = [...ALLOWED_VERTICALS, ...BLOCKED_VERTICALS] as const;

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return (DISPOSABLE_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function isBlockedVertical(vertical: string): boolean {
  return (BLOCKED_VERTICALS as readonly string[]).includes(vertical);
}

// --- D1: signup / account -----------------------------------------------

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const signupRequestSchema = z.object({
  email: emailSchema,
  // Optional: present for password signup, omitted for magic-link signup.
  // Hashed (scrypt, modules/auth/password.ts) and stored on our own
  // accounts row - see service.ts's signup() doc comment for why this
  // isn't left to the auth-provider abstraction the way magic-link/
  // verification tokens are.
  password: z.string().min(8).max(200).optional(),
  useCase: z.string().trim().min(10).max(2000),
  vertical: z.enum(VERTICALS),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const accountSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  useCase: z.string(),
  vertical: z.string(),
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  // J4: null means "use the plan default" - see accountSettingsSchema below
  // for the resolved *effective* value (override if set, else plan default).
  retentionOverrideDays: z.number().int().nullable(),
});
export type Account = z.infer<typeof accountSchema>;

// --- J4: account-level retention override --------------------------------

// Type-only here (whole number) - the actual [7, 365] bound is enforced by
// modules/events/retention.ts's assertValidRetentionOverrideDays, which is
// the single source of truth for that rule and its error message (used by
// both the API route and the retention job). Duplicating the bound here
// with a second, possibly-drifting message isn't worth it for a check this
// cheap to run once, server-side.
export const retentionOverrideDaysSchema = z.number().int();

export const accountSettingsUpdateRequestSchema = z.object({
  // Present to set/clear the override; omit the field entirely to leave it
  // unchanged. `null` clears it back to the plan default.
  retentionOverrideDays: retentionOverrideDaysSchema.nullable().optional(),
});
export type AccountSettingsUpdateRequest = z.infer<typeof accountSettingsUpdateRequestSchema>;

export const accountSettingsSchema = z.object({
  accountId: z.string().uuid(),
  plan: z.string(),
  retentionOverrideDays: z.number().int().nullable(),
  // The value retention.ts's job actually uses today: the override if set,
  // otherwise the plan default. Surfaced so the dashboard never shows a
  // blind override control without the current effective number (J4 scope).
  effectiveRetentionDays: z.number().int(),
});
export type AccountSettings = z.infer<typeof accountSettingsSchema>;

// --- D1/D3: API keys -----------------------------------------------------

// I3: named environments beyond the original test/live pair. Additive only -
// "test"/"live" keep their original values. `development` and `staging` are
// new non-production environments; `production` is the new spelling of
// `live`. Every call site that used to gate on `mode === "live"` should use
// `isProductionApiKeyMode` below instead, so a new non-production
// environment can never be mistaken for production.
export const apiKeyModeSchema = z.enum(["test", "live", "development", "staging", "production"]);
export type ApiKeyMode = z.infer<typeof apiKeyModeSchema>;

/** The two `ApiKeyMode` values that behave like today's "live" mode: real
 * sending, live-mode gates (email verification, live quota metering) apply.
 * Every other value - `test`, `development`, `staging`, and any future
 * non-production environment - behaves like today's "test" mode: mocked
 * send, no live quota consumption. Kept as the single source of truth so
 * emails/auth.ts, smtp/auth.ts, and billing quota metering can't drift from
 * each other on what counts as "production" (CLAUDE.md: send-eligibility
 * gates are security-relevant). */
export const PRODUCTION_API_KEY_MODES = ["live", "production"] as const satisfies readonly ApiKeyMode[];

export function isProductionApiKeyMode(mode: ApiKeyMode): boolean {
  return (PRODUCTION_API_KEY_MODES as readonly string[]).includes(mode);
}

/** The complement of PRODUCTION_API_KEY_MODES - every ApiKeyMode that
 * behaves like "test". Derived from apiKeyModeSchema/isProductionApiKeyMode
 * rather than hand-listed, so it can't drift if a future mode is ever added
 * to apiKeyModeSchema without updating this list too. */
export const NON_PRODUCTION_API_KEY_MODES = apiKeyModeSchema.options.filter(
  (mode) => !isProductionApiKeyMode(mode),
) as readonly ApiKeyMode[];

/** The dashboard Topbar's binary Production|Test toggle (EnvSwitch) - a
 * coarser view over the 5 ApiKeyMode values than the key-creation picker
 * above offers. Used to scope Logs search and the Overview summary by
 * which "bucket" of API-key modes sent an email. */
export const sendEnvironmentSchema = z.enum(["production", "test"]);
export type SendEnvironment = z.infer<typeof sendEnvironmentSchema>;

export function apiKeyModesForSendEnvironment(environment: SendEnvironment): readonly ApiKeyMode[] {
  return environment === "production" ? PRODUCTION_API_KEY_MODES : NON_PRODUCTION_API_KEY_MODES;
}

/** Environments offered when creating a *new* key beyond the automatic
 * test/live pair every account gets at signup (dashboard settings/api-keys
 * picker). `test`/`live` remain valid `ApiKeyMode` values (existing keys,
 * signup) but aren't re-offered here to avoid implying a second test/live
 * pair per environment. */
export const ADDITIONAL_API_KEY_ENVIRONMENTS = ["development", "staging", "production"] as const satisfies readonly ApiKeyMode[];

// Shape returned by list/label/revoke - never includes the raw key.
export const apiKeySummarySchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  prefix: z.string(),
  mode: apiKeyModeSchema,
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;

// Shape returned only once, at issuance (signup) or rotation - includes the
// raw secret so the caller can copy it down; never persisted or returned again.
export const issuedApiKeySchema = apiKeySummarySchema.extend({
  key: z.string(),
});
export type IssuedApiKey = z.infer<typeof issuedApiKeySchema>;

export const signupResponseSchema = z.object({
  account: accountSchema,
  apiKeys: z.array(issuedApiKeySchema).length(2),
});
export type SignupResponse = z.infer<typeof signupResponseSchema>;

// Google OAuth onboarding: the callback verifies identity but can't collect
// useCase/vertical (Google doesn't have them), so a first-time Google signer
// is routed to a short form carrying the short-lived pending-signup token
// alongside the same two fields signupRequestSchema requires.
export const googleCompleteSignupRequestSchema = z.object({
  token: z.string().min(1),
  useCase: z.string().trim().min(10).max(2000),
  vertical: z.enum(VERTICALS),
});
export type GoogleCompleteSignupRequest = z.infer<typeof googleCompleteSignupRequestSchema>;

// I1 (stories/EPIC-I-J-team-deliverability.md): these used to carry
// `accountId` in the body as a stand-in for a real session layer (see the
// old comment at the top of modules/auth/index.ts). Now that session
// verification exists and gates every route below, the caller's own session
// is authoritative for which account a key belongs to - a body-supplied
// accountId would either be redundant or, worse, a spoofing vector if ever
// trusted again by mistake. Dropped instead of kept-but-ignored.
export const labelApiKeyRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
});
export type LabelApiKeyRequest = z.infer<typeof labelApiKeyRequestSchema>;

// I3: creates one additional key in a chosen environment, distinct from the
// automatic test/live pair issued at signup (`createApiKeyPair`). Accepts
// any `ApiKeyMode`, not just `ADDITIONAL_API_KEY_ENVIRONMENTS`, so an
// account can still mint another `test`/`live` key if it wants to.
//
// I1: no `accountId` field here either, same reasoning as
// labelApiKeyRequestSchema above - the route derives it from the caller's
// own session + role instead of trusting a body-supplied value.
export const createApiKeyRequestSchema = z.object({
  mode: apiKeyModeSchema,
  label: z.string().trim().min(1).max(100).optional(),
});
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
