// J1 (Epic J - Deliverability+): dedicated IP add-on. Fully mocked per the
// resolved product decision in stories/EPIC-I-J-team-deliverability.md - see
// apps/api/src/modules/deliverability/ for the implementation and its own
// "no real AWS SES" doc comments.
import { z } from "zod";
import { idSchema } from "./common.js";

export const dedicatedIpStatusSchema = z.enum(["provisioning", "warming", "active", "deprovisioning"]);
export type DedicatedIpStatus = z.infer<typeof dedicatedIpStatusSchema>;

export const dedicatedIpSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  ipAddress: z.string(),
  sesPoolId: z.string(),
  status: dedicatedIpStatusSchema,
  warmupStage: z.number().int().nonnegative(),
  dailySendCap: z.number().int().nonnegative(),
  sendsToday: z.number().int().nonnegative(),
  requestedAt: z.string().datetime(),
  provisionedAt: z.string().datetime().nullable(),
  addOnPriceCents: z.number().int().nonnegative(),
  addOnBilled: z.boolean(),
});
export type DedicatedIpResponse = z.infer<typeof dedicatedIpSchema>;

export const dedicatedIpReputationStatusSchema = z.enum(["healthy", "watch", "at_risk"]);
export type DedicatedIpReputationStatus = z.infer<typeof dedicatedIpReputationStatusSchema>;

export const dedicatedIpReputationSchema = z.object({
  dedicatedIpId: idSchema,
  bounceRate: z.number().nonnegative(),
  complaintRate: z.number().nonnegative(),
  reputationStatus: dedicatedIpReputationStatusSchema,
  asOf: z.string().datetime(),
});
export type DedicatedIpReputation = z.infer<typeof dedicatedIpReputationSchema>;

export const requestDedicatedIpErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});
