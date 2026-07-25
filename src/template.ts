// Owned by: Track E (Templates API, G8/G9).
// See stories/SPRINT-full-backlog-5day-10person.md's promotion note and
// 04-product-backlog.md's Epic G / K.
import { z } from "zod";

export const MAX_TEMPLATE_VARIABLES = 50;

// --- Primitives ---

const templateNameSchema = z.string().trim().min(1).max(200);
const templateSubjectSchema = z.string().min(1).max(998);

/** Declared `{{variable}}` placeholder names - see db/schema/template.ts for
 * why these are supplied explicitly rather than parsed out of the body. */
export const templateVariableNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_]+$/, "Variable names may only contain letters, numbers, and underscores");

export const templateVariablesSchema = z.array(templateVariableNameSchema).max(MAX_TEMPLATE_VARIABLES);

// --- POST /templates ---

export const createTemplateRequestSchema = z
  .object({
    name: templateNameSchema,
    subject: templateSubjectSchema,
    html: z.string().optional(),
    text: z.string().optional(),
    variables: templateVariablesSchema.optional(),
  })
  .refine((value) => Boolean(value.html) || Boolean(value.text), {
    message: "At least one of `html` or `text` is required",
    path: ["html"],
  });
export type CreateTemplateRequest = z.infer<typeof createTemplateRequestSchema>;

// --- PUT /templates/:id (creates a new version, G9) ---

export const updateTemplateRequestSchema = z
  .object({
    name: templateNameSchema.optional(),
    subject: templateSubjectSchema.optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    variables: templateVariablesSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>;

// --- Responses ---

export const templateResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
  variables: z.array(z.string()),
  version: z.number().int(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type TemplateResponse = z.infer<typeof templateResponseSchema>;

// --- GET /templates ---

export const listTemplatesResponseSchema = z.object({
  templates: z.array(templateResponseSchema),
});
export type ListTemplatesResponse = z.infer<typeof listTemplatesResponseSchema>;

// --- GET /templates/:id/versions (G9) ---

export const templateVersionResponseSchema = z.object({
  version: z.number().int(),
  name: z.string(),
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
  variables: z.array(z.string()),
  created_at: z.string().datetime({ offset: true }),
});
export type TemplateVersionResponse = z.infer<typeof templateVersionResponseSchema>;

export const listTemplateVersionsResponseSchema = z.object({
  versions: z.array(templateVersionResponseSchema),
});
export type ListTemplateVersionsResponse = z.infer<typeof listTemplateVersionsResponseSchema>;
