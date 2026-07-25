// Owned by: Track 3 (Sending core).
// See stories/SPRINT-full-backlog-5day-10person.md, Track 3 (A1-A7), for
// acceptance criteria on send/batch/attachments/scheduling/validation.
import { z } from "zod";

// --- Limits (shared between API and dashboard so both enforce the same caps) ---

/** Max size of a single attachment, in bytes, after decoding. SES caps a raw
 * message (including attachments) at 10MB; we leave headroom for the rest of
 * the message. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB
/** Max combined size of all attachments on one email. */
export const MAX_TOTAL_ATTACHMENTS_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_EMAIL = 10;
/** Remote attachment fetch: hard timeout and byte cap, enforced by the caller. */
export const REMOTE_ATTACHMENT_TIMEOUT_MS = 5_000;
export const REMOTE_ATTACHMENT_MAX_BYTES = MAX_ATTACHMENT_BYTES;

export const MAX_RECIPIENTS_PER_FIELD = 50;
export const MAX_BATCH_SIZE = 100;

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h, per A3

// --- Primitives ---

/** Accepts a bare address or a "Display Name <addr@example.com>" form. */
const displayNameEmailPattern = /^(?:"?[^"<>]*"?\s*)?<?([^<>\s]+@[^<>\s]+\.[^<>\s]+)>?$/;

/**
 * Pulls the bare `addr@host` out of either a plain address or a
 * "Display Name <addr@host>" form, so callers that need the address itself
 * (not just to validate the field) share one parser with the schema above.
 * Returns null if the input isn't a recognizable address.
 */
export function extractEmailAddress(value: string): string | null {
  const match = displayNameEmailPattern.exec(value.trim());
  return match?.[1] ?? null;
}

export const emailAddressSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine((value) => displayNameEmailPattern.test(value), {
    message: "Must be a valid email address, optionally with a display name",
  });

const recipientListSchema = z
  .union([emailAddressSchema, z.array(emailAddressSchema).min(1).max(MAX_RECIPIENTS_PER_FIELD)])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const base64AttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).optional(),
  content: z.string().min(1), // base64-encoded
});

export const urlAttachmentSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  contentType: z.string().min(1).max(255).optional(),
  url: z.string().url(),
});

export const attachmentSchema = z.union([base64AttachmentSchema, urlAttachmentSchema]);

export function isUrlAttachment(
  attachment: z.infer<typeof attachmentSchema>,
): attachment is z.infer<typeof urlAttachmentSchema> {
  return "url" in attachment;
}

// --- POST /emails ---

export const sendEmailRequestSchema = z
  .object({
    from: emailAddressSchema,
    to: recipientListSchema,
    cc: recipientListSchema.optional(),
    bcc: recipientListSchema.optional(),
    reply_to: emailAddressSchema.optional(),
    subject: z.string().min(1).max(998),
    html: z.string().optional(),
    text: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS_PER_EMAIL).optional(),
    /** A6 — ISO 8601 timestamp. Omit to send immediately. */
    send_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine((value) => Boolean(value.html) || Boolean(value.text), {
    message: "At least one of `html` or `text` is required",
    path: ["html"],
  });

export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;

export const emailStatusEnum = z.enum(["queued", "scheduled", "sent", "send_error", "canceled"]);
export type EmailStatus = z.infer<typeof emailStatusEnum>;

export const sendEmailResponseSchema = z.object({
  id: z.string().uuid(),
  status: emailStatusEnum,
});
export type SendEmailResponse = z.infer<typeof sendEmailResponseSchema>;

// --- POST /emails/batch ---

export const batchSendRequestSchema = z.object({
  emails: z.array(sendEmailRequestSchema).min(1).max(MAX_BATCH_SIZE),
});
export type BatchSendRequest = z.infer<typeof batchSendRequestSchema>;

export const batchSendResultItemSchema = z.discriminatedUnion("status", [
  z.object({ index: z.number().int(), status: z.literal("queued"), id: z.string().uuid() }),
  z.object({ index: z.number().int(), status: z.literal("scheduled"), id: z.string().uuid() }),
  z.object({ index: z.number().int(), status: z.literal("failed"), error: z.string() }),
]);
export type BatchSendResultItem = z.infer<typeof batchSendResultItemSchema>;

export const batchSendResponseSchema = z.object({
  results: z.array(batchSendResultItemSchema),
});
export type BatchSendResponse = z.infer<typeof batchSendResponseSchema>;

// --- GET /emails/:id ---

export const getEmailResponseSchema = z.object({
  id: z.string().uuid(),
  status: emailStatusEnum,
  to: z.array(z.string()),
  subject: z.string(),
  send_at: z.string().datetime({ offset: true }).nullable(),
  sent_at: z.string().datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
});
export type GetEmailResponse = z.infer<typeof getEmailResponseSchema>;

// --- POST /emails/validate (A7 — free on every plan) ---

export const validateEmailRequestSchema = z.object({
  email: z.string().min(3).max(320),
});
export type ValidateEmailRequest = z.infer<typeof validateEmailRequestSchema>;

export const validateEmailResponseSchema = z.object({
  email: z.string(),
  valid: z.boolean(),
  syntax_valid: z.boolean(),
  disposable: z.boolean(),
  // Informational only - a role local part (support@, admin@, ...) is a
  // real, permanently deliverable mailbox, so it never flips `valid` to
  // false the way `disposable` does. Callers who want to exclude role
  // accounts (e.g. for a "who's the real person" signup flow) can filter on
  // this themselves.
  role_account: z.boolean(),
  mx_found: z.boolean(),
  reason: z.string().optional(),
});
export type ValidateEmailResponse = z.infer<typeof validateEmailResponseSchema>;
