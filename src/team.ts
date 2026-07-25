// I1 (stories/EPIC-I-J-team-deliverability.md): team members + roles.
import { z } from "zod";

export const memberRoleSchema = z.enum(["admin", "developer", "viewer"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const teamMemberSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  role: memberRoleSchema,
  invitedAt: z.string().datetime(),
  // Null while the invite is pending (not yet accepted).
  acceptedAt: z.string().datetime().nullable(),
  // True once acceptedAt is set - convenience flag so the dashboard doesn't
  // have to derive "pending vs. active" from a null check itself.
  status: z.enum(["active", "pending"]),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const listTeamMembersResponseSchema = z.object({
  members: z.array(teamMemberSchema),
});
export type ListTeamMembersResponse = z.infer<typeof listTeamMembersResponseSchema>;

export const inviteTeamMemberRequestSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema,
});
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberRequestSchema>;

export const inviteTeamMemberResponseSchema = z.object({
  member: teamMemberSchema,
  // The invite link's token is never actually emailed by this sandbox (no
  // real email-sending infra exists yet in this codebase - see
  // modules/auth/provider.ts's MockAuthProvider, which returns its tokens in
  // dev responses for the same reason). Surfaced here so the flow is
  // testable end-to-end; a real deployment would drop this field once
  // delivery is wired up and rely on the emailed link instead.
  devInviteToken: z.string().optional(),
});
export type InviteTeamMemberResponse = z.infer<typeof inviteTeamMemberResponseSchema>;

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

export const acceptInviteResponseSchema = z.object({
  member: teamMemberSchema,
});
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;

export const updateMemberRoleRequestSchema = z.object({
  role: memberRoleSchema,
});
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;

export const updateMemberRoleResponseSchema = z.object({
  member: teamMemberSchema,
});
export type UpdateMemberRoleResponse = z.infer<typeof updateMemberRoleResponseSchema>;

// I4 (stories/EPIC-I-J-team-deliverability.md): audit log of account
// actions. Read-only from the dashboard's perspective - there's no write
// path exposed to humans, every entry comes from another route's own write
// point (see apps/api/src/modules/audit-log/service.ts's recordAuditEvent).
export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  // Resolved server-side for display; null for a system-initiated action
  // (no actor) or one whose actor account no longer resolves.
  actorEmail: emailSchema.nullable(),
  action: z.string(),
  // A human-readable, non-secret identifier for what the action touched -
  // e.g. "domain:example.com" or "api_key:env_live_ab12cd34" (a key's
  // public prefix). Never a raw API key or a recipient's email address.
  target: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const listAuditLogResponseSchema = z.object({
  entries: z.array(auditLogEntrySchema),
});
export type ListAuditLogResponse = z.infer<typeof listAuditLogResponseSchema>;
