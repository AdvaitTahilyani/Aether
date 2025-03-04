import { z } from "zod";
import { emailSchema } from "./email";

export const threadSchema = z.object({
  id: z.string(),
  snippet: z.string(),
  historyId: z.string(),
  messages: z.array(emailSchema),
});
