// Owned by: Track 2 (Domains & DNS).
// See stories/SPRINT-full-backlog-5day-10person.md, Track 2 (B1-B5).
import { z } from "zod";
import { idSchema } from "./common.js";

// A conservative hostname matcher: labels of 1-63 alphanumeric/hyphen chars
// (no leading/trailing hyphen), at least one dot, max 253 chars overall.
// Deliberately does not allow a bare TLD or protocol/paths - this field is a
// hostname, not a URL.
const HOSTNAME_PATTERN = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

export const domainNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(HOSTNAME_PATTERN, "must be a valid domain name, e.g. customer.com");

export const domainStatusSchema = z.enum(["pending", "verified", "failed"]);
export type DomainStatus = z.infer<typeof domainStatusSchema>;

export const dnsRecordTypeSchema = z.enum(["CNAME", "TXT", "MX"]);
export type DnsRecordType = z.infer<typeof dnsRecordTypeSchema>;

// What a DNS record is *for* - lets the UI group/label records without
// re-deriving purpose from the host string.
export const dnsRecordPurposeSchema = z.enum([
  "dkim",
  "spf",
  "return-path-mx",
  "return-path-spf",
  "dmarc",
]);
export type DnsRecordPurpose = z.infer<typeof dnsRecordPurposeSchema>;

export const dnsRecordSchema = z.object({
  type: dnsRecordTypeSchema,
  host: z.string(),
  value: z.string(),
  // Only present for MX records.
  priority: z.number().int().optional(),
  purpose: dnsRecordPurposeSchema,
  verified: z.boolean(),
});
export type DnsRecord = z.infer<typeof dnsRecordSchema>;

export const dmarcGuidanceSchema = z.object({
  // A *suggested* record - Envello doesn't host or enforce DMARC (B3 is
  // guidance only), so this is informational, not something we verify.
  record: dnsRecordSchema.omit({ verified: true }),
  notes: z.array(z.string()),
});
export type DmarcGuidance = z.infer<typeof dmarcGuidanceSchema>;

export const domainSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  domain: domainNameSchema,
  sendingSubdomain: domainNameSchema,
  returnPathSubdomain: domainNameSchema.nullable(),
  dkimSelector: z.string(),
  status: domainStatusSchema,
  dkimVerifiedAt: z.string().datetime().nullable(),
  spfVerifiedAt: z.string().datetime().nullable(),
  returnPathVerifiedAt: z.string().datetime().nullable(),
  lastCheckedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Domain = z.infer<typeof domainSchema>;

export const createDomainRequestSchema = z.object({
  domain: domainNameSchema,
  // Optional override - the API always default-suggests `mail.<domain>`
  // (see suggestSendingSubdomain below) and the dashboard pre-fills it, per
  // B1's subdomain-first differentiation, but a caller can pick another
  // subdomain of their own domain.
  sendingSubdomain: domainNameSchema.optional(),
  returnPathSubdomain: domainNameSchema.optional(),
});
export type CreateDomainRequest = z.infer<typeof createDomainRequestSchema>;

export const setReturnPathRequestSchema = z.object({
  returnPathSubdomain: domainNameSchema,
});
export type SetReturnPathRequest = z.infer<typeof setReturnPathRequestSchema>;

// J2 - blocklist monitoring (stories/EPIC-I-J-team-deliverability.md). A
// domain-level reputation summary against external public DNSBLs, distinct
// from per-recipient suppression. Optional because a domain that's never
// been checked yet (e.g. just added, before the daily monitor's first pass)
// has no summary to report.
export const domainBlocklistStatusSchema = z.object({
  listed: z.boolean(),
  listedOn: z.array(z.string()),
  checkedAt: z.string().datetime().nullable(),
});
export type DomainBlocklistStatus = z.infer<typeof domainBlocklistStatusSchema>;

export const domainWithDnsSchema = z.object({
  domain: domainSchema,
  dnsRecords: z.array(dnsRecordSchema),
  dmarc: dmarcGuidanceSchema,
  blocklistStatus: domainBlocklistStatusSchema.optional(),
});
export type DomainWithDns = z.infer<typeof domainWithDnsSchema>;

export const listDomainsResponseSchema = z.object({
  domains: z.array(domainWithDnsSchema),
  limit: z.number().int(),
});
export type ListDomainsResponse = z.infer<typeof listDomainsResponseSchema>;

/**
 * Default-suggest a subdomain over the root domain: `mail.<domain>`.
 * Shared between the API (as the default when a caller doesn't pass
 * `sendingSubdomain`) and the dashboard (to pre-fill the add-domain form) so
 * the two never drift.
 *
 * Per 01-market-analysis.md, none of Resend/Postmark/SendGrid/Mailgun
 * default to subdomain-first - this is a deliberate differentiator.
 */
export function suggestSendingSubdomain(domain: string): string {
  return `mail.${domain.trim().toLowerCase()}`;
}
