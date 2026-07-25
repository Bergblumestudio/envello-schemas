// Owned by: Track 4 (Events, logs & webhooks).
// See stories/SPRINT-full-backlog-5day-10person.md, Track 4 (C1-C7).
import { z } from "zod";
import { sendEnvironmentSchema } from "./account.js";

// --- C1: SES event ingestion -------------------------------------------
//
// Real SES event notifications don't carry our internal account id. In
// production this would arrive via SNS -> SQS, and the ingester would
// resolve accountId by looking up `mail.messageId` against Agent 3's
// `emails` table (id, account_id, status) once that table exists. Until
// that reconciliation lands, the caller (Agent 3's send worker, or this
// sandbox's test harness) passes accountId/emailId alongside the raw SES
// shape. This keeps the endpoint trivially swappable from an HTTP webhook
// to a real SQS consumer later: both just need to produce this same shape.

export const sesMailSchema = z.object({
  timestamp: z.string(),
  messageId: z.string(),
  source: z.string(),
  destination: z.array(z.string()),
});

export const sesBounceSchema = z.object({
  bounceType: z.enum(["Permanent", "Transient", "Undetermined"]),
  bounceSubType: z.string(),
  bouncedRecipients: z
    .array(
      z.object({
        emailAddress: z.string(),
        action: z.string().optional(),
        status: z.string().optional(),
        diagnosticCode: z.string().optional(),
      }),
    )
    .min(1),
  timestamp: z.string(),
  feedbackId: z.string(),
});

export const sesComplaintSchema = z.object({
  complainedRecipients: z.array(z.object({ emailAddress: z.string() })).min(1),
  timestamp: z.string(),
  feedbackId: z.string(),
  complaintFeedbackType: z.string().optional(),
});

export const sesDeliverySchema = z.object({
  timestamp: z.string(),
  recipients: z.array(z.string()).min(1),
  smtpResponse: z.string().optional(),
  reportingMTA: z.string().optional(),
});

export const sesRejectSchema = z.object({
  reason: z.string(),
});

export const sesEventNotificationSchema = z.discriminatedUnion("notificationType", [
  z.object({ notificationType: z.literal("Delivery"), mail: sesMailSchema, delivery: sesDeliverySchema }),
  z.object({ notificationType: z.literal("Bounce"), mail: sesMailSchema, bounce: sesBounceSchema }),
  z.object({ notificationType: z.literal("Complaint"), mail: sesMailSchema, complaint: sesComplaintSchema }),
  z.object({ notificationType: z.literal("Reject"), mail: sesMailSchema, reject: sesRejectSchema }),
]);

export const sesEventIngestSchema = z.object({
  accountId: z.string().uuid(),
  emailId: z.string().uuid().optional(),
  event: sesEventNotificationSchema,
});

export type SesEventNotification = z.infer<typeof sesEventNotificationSchema>;
export type SesEventIngest = z.infer<typeof sesEventIngestSchema>;

// --- C3: log search -------------------------------------------------------

export const emailEventStatusSchema = z.enum([
  "delivered",
  "bounce",
  "complaint",
  "reject",
  "open",
  "click",
]);

export const logSearchQuerySchema = z.object({
  // Session auth landed (apps/api/src/modules/events/index.ts derives the
  // real accountId from requireMember) - optional and ignored server-side,
  // kept only so an old caller still sending it doesn't fail validation.
  accountId: z.string().uuid().optional(),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  status: emailEventStatusSchema.optional(),
  domain: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Topbar's Production|Test toggle (dashboard/components/shell/topbar.tsx).
  // Omitted = every mode, matching this endpoint's behavior before the
  // toggle was wired up.
  environment: sendEnvironmentSchema.optional(),
});

export type LogSearchQuery = z.infer<typeof logSearchQuerySchema>;

// D2: same Production|Test scoping for the dashboard home summary.
export const dashboardSummaryQuerySchema = z.object({
  environment: sendEnvironmentSchema.optional(),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

// --- C6: suppression list --------------------------------------------------

export const suppressionCreateSchema = z.object({
  // Ignored server-side in favor of the session-derived accountId - see
  // logSearchQuerySchema's comment above.
  accountId: z.string().uuid().optional(),
  email: z.string().email(),
});

export const suppressionListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
});

export type SuppressionCreateInput = z.infer<typeof suppressionCreateSchema>;

// --- C4: customer webhooks --------------------------------------------------

// Customer-facing event names. Note these read differently from the
// internal SES-shaped event_type column (bounce -> bounced, etc) - see
// toWebhookEventType() in modules/events/webhook-dispatch.ts.
export const webhookEventTypeSchema = z.enum([
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
]);

export const webhookEndpointCreateSchema = z.object({
  // Ignored server-side in favor of the session-derived accountId - see
  // logSearchQuerySchema's comment above.
  accountId: z.string().uuid().optional(),
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema).min(1),
});

export const webhookEndpointUpdateSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(webhookEventTypeSchema).min(1).optional(),
  enabled: z.boolean().optional(),
});

export const webhookPayloadSchema = z.object({
  id: z.string().uuid(),
  type: webhookEventTypeSchema,
  createdAt: z.string(),
  data: z.record(z.unknown()),
});

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;
export type WebhookEndpointCreateInput = z.infer<typeof webhookEndpointCreateSchema>;
export type WebhookEndpointUpdateInput = z.infer<typeof webhookEndpointUpdateSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// --- C5: open/click tracking ------------------------------------------------

export const trackingSettingsUpdateSchema = z.object({
  // Ignored server-side in favor of the session-derived accountId - see
  // logSearchQuerySchema's comment above.
  accountId: z.string().uuid().optional(),
  domain: z.string(),
  domainId: z.string().uuid().optional(),
  openTrackingEnabled: z.boolean().optional(),
  clickTrackingEnabled: z.boolean().optional(),
});

export type TrackingSettingsUpdateInput = z.infer<typeof trackingSettingsUpdateSchema>;

// --- C7/J3: inbound email, address-based routing + attachments -------------

// J3: the local-part a route matches, e.g. "support" for support@example.com.
// Omitted (stored as NULL) means "this is the domain's catch-all route" -
// the C7 MVP shape, still supported unchanged.
const inboundAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .regex(/^[a-z0-9._%+-]+$/, 'address must be a valid local-part, e.g. "support" (no "@domain")');

export const inboundRouteCreateSchema = z.object({
  // Ignored server-side in favor of the session-derived accountId - see
  // logSearchQuerySchema's comment above.
  accountId: z.string().uuid().optional(),
  domain: z.string(),
  domainId: z.string().uuid().optional(),
  webhookUrl: z.string().url(),
  address: inboundAddressSchema.optional(),
});

// J3: a reference to an attachment persisted out-of-band (see
// modules/events/attachment-storage.ts) - never the raw bytes. `url` is
// retrievable by its unguessable id, the same bearer-capability pattern this
// module already uses for inbound route tokens.
export const inboundAttachmentRefSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string().optional(),
  size: z.number().int().nonnegative(),
  url: z.string().url(),
});

export const inboundParsedEmailSchema = z.object({
  to: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(inboundAttachmentRefSchema).optional(),
});

export type InboundRouteCreateInput = z.infer<typeof inboundRouteCreateSchema>;
export type InboundAttachmentRef = z.infer<typeof inboundAttachmentRefSchema>;
export type InboundParsedEmail = z.infer<typeof inboundParsedEmailSchema>;

// --- D2: dashboard home summary ---

export const dashboardSummaryResponseSchema = z.object({
  sendsToday: z.number().int().nonnegative(),
  sendsThisMonth: z.number().int().nonnegative(),
  deliveryRatePct: z.number().nullable(),
  bounceRatePct: z.number().nullable(),
  complaintRatePct: z.number().nullable(),
});
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;
