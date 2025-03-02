import { z } from "zod";

// Email Header Schema
export const EmailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

// Email Body Schema
export const EmailBodySchema = z.object({
  data: z.string().optional(),
  size: z.number().optional(),
});

// Email Part Schema
export const EmailPartSchema = z.object({
  mimeType: z.string(),
  headers: z.array(EmailHeaderSchema),
  body: EmailBodySchema.optional(),
});

// Email Payload Schema
export const EmailPayloadSchema = z.object({
  headers: z.array(EmailHeaderSchema),
  mimeType: z.string(),
  body: EmailBodySchema.optional(),
  parts: z.array(EmailPartSchema).optional(),
});

// Email Details Schema
export const EmailDetailsSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()),
  snippet: z.string(),
  payload: EmailPayloadSchema,
  sizeEstimate: z.number(),
  historyId: z.string(),
  internalDate: z.string(),
});

// Basic Email Schema (for list responses)
export const BasicEmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
});

// Export types derived from schemas
export type EmailHeader = z.infer<typeof EmailHeaderSchema>;
export type EmailBody = z.infer<typeof EmailBodySchema>;
export type EmailPart = z.infer<typeof EmailPartSchema>;
export type EmailPayload = z.infer<typeof EmailPayloadSchema>;
export type EmailDetails = z.infer<typeof EmailDetailsSchema>;
export type BasicEmail = z.infer<typeof BasicEmailSchema>;
