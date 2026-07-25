// Owned by: Track 5/6/7 (Billing & abuse/safety). See
// stories/SPRINT-full-backlog-5day-10person.md, Track 6/7 (F1-F5, E2-E5).
import { z } from "zod";
import { idSchema } from "./common.js";

// --- F1/F4: plan catalog + checkout ----------------------------------------

export const billingIntervalSchema = z.enum(["month", "year"]);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceMonthlyCents: z.number().int().nonnegative(),
  priceAnnualCents: z.number().int().nonnegative().nullable(),
  monthlyEmailQuota: z.number().int().nonnegative(),
  domainLimit: z.number().int().nonnegative(),
  logRetentionDays: z.number().int().nonnegative(),
  overagePricePerThousandCents: z.number().int().nonnegative().nullable(),
});
export type Plan = z.infer<typeof planSchema>;

export const createCheckoutSessionRequestSchema = z.object({
  accountId: idSchema,
  planId: z.string(),
  interval: billingIntervalSchema,
  // Optional VAT ID for EU B2B reverse charge; Stripe Tax validates it.
  vatId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutSessionRequest = z.infer<typeof createCheckoutSessionRequestSchema>;

export const createCheckoutSessionResponseSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
});
export type CreateCheckoutSessionResponse = z.infer<typeof createCheckoutSessionResponseSchema>;

// --- Subscription state -----------------------------------------------------

export const subscriptionStatusSchema = z.enum([
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  planId: z.string(),
  billingInterval: billingIntervalSchema,
  status: subscriptionStatusSchema,
  currentPeriodStart: z.string().datetime().nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  overageOptIn: z.boolean(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

// --- F2: overage / usage summary --------------------------------------------

export const usageSummarySchema = z.object({
  accountId: idSchema,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  quota: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  percentUsed: z.number().nonnegative(),
  overageUnits: z.number().int().nonnegative(),
  overageCostCents: z.number().int().nonnegative(),
});
export type UsageSummary = z.infer<typeof usageSummarySchema>;

// --- F3: quota alerts --------------------------------------------------------

export const quotaAlertLevelSchema = z.enum(["80pct", "100pct"]);
export type QuotaAlertLevel = z.infer<typeof quotaAlertLevelSchema>;

// --- E2/E3: account limits & warmup ladder -----------------------------------

export const accountLimitsSchema = z.object({
  accountId: idSchema,
  dailySendCap: z.number().int().positive(),
  warmupStepIndex: z.number().int().nonnegative(),
  consecutiveGoodDays: z.number().int().nonnegative(),
  pausedAt: z.string().datetime().nullable(),
  pauseReason: z.string().nullable(),
});
export type AccountLimits = z.infer<typeof accountLimitsSchema>;

// --- F5: DPA ------------------------------------------------------------------

export const dpaDocumentSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  version: z.number().int().positive(),
  generatedAt: z.string().datetime(),
});
export type DpaDocument = z.infer<typeof dpaDocumentSchema>;

export const generateDpaRequestSchema = z.object({
  accountId: idSchema,
  companyName: z.string().min(1),
  companyAddress: z.string().min(1),
  signatoryName: z.string().min(1).optional(),
});
export type GenerateDpaRequest = z.infer<typeof generateDpaRequestSchema>;

// --- E4: content scanning -----------------------------------------------------

export const contentScanRequestSchema = z.object({
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
});
export type ContentScanRequest = z.infer<typeof contentScanRequestSchema>;

export const contentScanVerdictSchema = z.enum(["clean", "flagged", "blocked"]);
export type ContentScanVerdict = z.infer<typeof contentScanVerdictSchema>;

export const contentScanResultSchema = z.object({
  verdict: contentScanVerdictSchema,
  matchedRules: z.array(z.string()),
  score: z.number().int().nonnegative(),
});
export type ContentScanResult = z.infer<typeof contentScanResultSchema>;
