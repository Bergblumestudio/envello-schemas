// CEO KRA dashboard (Tower "Envello" page) - business-operating metrics
// distinct from the customer-facing dashboard summary in event.ts. Every
// numeric metric here is designed to render "no data yet" rather than a
// misleading 0/0%, per the KRA build spec's small-n honesty rule - see
// kraMetricSchema and computeRatePct in modules/ops/kra/compute.ts.
import { z } from "zod";

export const ragStateSchema = z.enum(["green", "amber", "red"]);
export type RagState = z.infer<typeof ragStateSchema>;

// A single tile/row value with enough context to render a full KRA card:
// current + prior + delta, the target it's being held to (human-readable,
// since some targets are thresholds and others are "grow week over week"),
// the resulting RAG state, and whether the sample size is too small to
// trust the number at face value.
export const kraMetricSchema = z.object({
  value: z.number().nullable(),
  priorValue: z.number().nullable(),
  delta: z.number().nullable(),
  target: z.string(),
  rag: ragStateSchema,
  lowConfidence: z.boolean(),
  note: z.string().optional(),
});
export type KraMetric = z.infer<typeof kraMetricSchema>;

export const kraExceptionSectionSchema = z.enum([
  "deliverability",
  "reliability",
  "revenue",
  "usage",
  "trust",
  "ops",
]);
export type KraExceptionSection = z.infer<typeof kraExceptionSectionSchema>;

export const kraExceptionSchema = z.object({
  severity: z.enum(["amber", "red"]),
  code: z.string(),
  message: z.string(),
  section: kraExceptionSectionSchema,
});
export type KraException = z.infer<typeof kraExceptionSchema>;

// --- GET /ops/kra/summary --------------------------------------------------

export const kraSummaryResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  days: z.number().int(),
  internalAccountCount: z.number().int(),
  tiles: z.object({
    mrrCents: kraMetricSchema,
    payingCustomers: kraMetricSchema.extend({
      newCount: z.number().int(),
      churnedCount: z.number().int(),
    }),
    activationRate: kraMetricSchema,
    verifiedDomainsActivelySending: kraMetricSchema,
    complaintRatePct: kraMetricSchema,
    bounceRatePct: kraMetricSchema,
    apiP99Ms: kraMetricSchema,
    uptimePct: kraMetricSchema,
  }),
  exceptions: z.array(kraExceptionSchema),
});
export type KraSummaryResponse = z.infer<typeof kraSummaryResponseSchema>;

// --- GET /ops/kra/funnel ---------------------------------------------------

export const kraFunnelStepSchema = z.object({
  step: z.string(),
  count: z.number().int(),
  conversionFromPrevPct: z.number().nullable(),
});

export const kraFunnelCohortSchema = z.object({
  cohortMonth: z.string(),
  signups: z.number().int(),
  steps: z.array(kraFunnelStepSchema),
  medianTimeToFirstLiveSendHours: z.number().nullable(),
});

export const kraFunnelResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  cohorts: z.array(kraFunnelCohortSchema),
  biggestDropOffStep: z.string().nullable(),
  lowConfidence: z.boolean(),
});
export type KraFunnelResponse = z.infer<typeof kraFunnelResponseSchema>;

// --- GET /ops/kra/usage -----------------------------------------------------

export const kraDailyVolumeSchema = z.object({
  date: z.string(),
  liveCount: z.number().int(),
  testCount: z.number().int(),
});

export const kraQuotaAccountSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string(),
  planId: z.string(),
  utilisationPct: z.number(),
  sentInPeriod: z.number().int(),
  quota: z.number().int(),
});

export const kraDedicatedIpSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  warmupStage: z.number().int(),
  hoursInCurrentState: z.number().nullable(),
});

export const kraUsageResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  days: z.number().int(),
  liveSends: z.object({
    today: z.number().int(),
    sevenDay: z.number().int(),
    thirtyDay: z.number().int(),
  }),
  testSendsThirtyDay: z.number().int(),
  dailyVolume: z.array(kraDailyVolumeSchema),
  activeSendingAccounts: z.object({ sevenDay: z.number().int(), thirtyDay: z.number().int() }),
  highQuotaAccounts: z.array(kraQuotaAccountSchema),
  lowQuotaAccounts: z.array(kraQuotaAccountSchema),
  overageRevenueCents: z.number().int(),
  overageOptInCount: z.number().int(),
  dedicatedIps: z.object({
    byStatus: z.record(z.string(), z.number().int()),
    stuckProvisioning: z.array(kraDedicatedIpSchema),
  }),
  internalUsage: z.object({ liveSends30d: z.number().int() }),
});
export type KraUsageResponse = z.infer<typeof kraUsageResponseSchema>;

// --- GET /ops/kra/retention -------------------------------------------------

export const kraAtRiskAccountSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string(),
  planId: z.string(),
  daysRemaining: z.number().int().nullable(),
  reason: z.string(),
});

export const kraRetentionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  days: z.number().int(),
  churnedMrrCents: kraMetricSchema,
  logoChurnPct: kraMetricSchema,
  cancelling: z.array(kraAtRiskAccountSchema),
  pastDue: z.array(kraAtRiskAccountSchema),
  silentPayingAccounts: z.array(kraAtRiskAccountSchema),
  arpuCents: kraMetricSchema,
  grossMarginPct: kraMetricSchema,
});
export type KraRetentionResponse = z.infer<typeof kraRetentionResponseSchema>;

// --- GET /ops/kra/trust -----------------------------------------------------

export const kraWorstAccountSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string(),
  complaintRatePct: z.number().nullable(),
  bounceRatePct: z.number().nullable(),
  volume30d: z.number().int(),
  lowConfidence: z.boolean(),
});

export const kraTrustResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  days: z.number().int(),
  suppressions: z.object({
    total: z.number().int(),
    addedInPeriod: z.number().int(),
    byReason: z.record(z.string(), z.number().int()),
  }),
  worstAccounts: z.array(kraWorstAccountSchema),
  webhooks: z.object({
    failureRatePct: z.number().nullable(),
    stuckRetrying: z.number().int(),
  }),
  openOpsAlerts: z.object({ critical: z.number().int(), warning: z.number().int() }),
  sesHealth: z
    .object({
      sendingEnabled: z.boolean(),
      enforcementStatus: z.string().nullable(),
      productionAccessEnabled: z.boolean().nullable(),
      max24HourSend: z.number().nullable(),
      sentLast24Hours: z.number().nullable(),
    })
    .nullable(),
  warmupThrottled: z.array(
    z.object({ accountId: z.string().uuid(), email: z.string(), dailySendCap: z.number().int() }),
  ),
  dpasGenerated: z.number().int(),
});
export type KraTrustResponse = z.infer<typeof kraTrustResponseSchema>;

// --- Shared query-param schemas ---------------------------------------------

export const kraDaysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
export type KraDaysQuery = z.infer<typeof kraDaysQuerySchema>;

export const kraFunnelQuerySchema = z.object({
  cohorts: z.coerce.number().int().min(1).max(12).default(3),
});
export type KraFunnelQuery = z.infer<typeof kraFunnelQuerySchema>;
