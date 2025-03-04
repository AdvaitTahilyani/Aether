import { z } from "zod";

export const emailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const emailMessagePartBodySchema = z.object({
  attachmentId: z.string().optional(),
  size: z.number(),
  data: z.string(),
});

export interface EmailMessagePart {
  mimeType: string;
  filename?: string;
  size: number;
  data: string;
  headers: z.infer<typeof emailHeaderSchema>;
  body: z.infer<typeof emailMessagePartBodySchema>;
  parts?: EmailMessagePart[];
}

const emailMessagePartSchema: z.ZodType<EmailMessagePart> = z.object({
  mimeType: z.string(),
  filename: z.string().optional(), // Matches `string | undefined`
  size: z.number(),
  data: z.string(),
  headers: emailHeaderSchema,
  body: emailMessagePartBodySchema,
  parts: z.lazy(() => emailMessagePartSchema.array()).optional(), // Recursive definition
});

export const emailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()),
  snippet: z.string(),
  historyId: z.string(),
  internalDate: z.string(),
  sizeEstimate: z.number(),
  raw: z.string(),
  payload: emailMessagePartSchema,
});

// how to create a zod schema from a typescript type?
