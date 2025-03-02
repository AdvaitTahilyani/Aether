import { z } from "zod";
import { BasicEmailSchema, EmailDetailsSchema } from "../types/email";

// Helper function to check if the Electron API is available
export const isElectronAPIAvailable = (): boolean => {
  return !!window.electronAPI;
};

// Helper function to validate the Electron API shape
export const validateElectronAPI = (): boolean => {
  if (!window.electronAPI) return false;

  try {
    // Create a partial schema that only checks for required methods
    const PartialElectronAPISchema = z.object({
      loginWithGoogle: z.function().returns(z.promise(z.string())),
      getEmails: z.function().returns(z.promise(z.array(BasicEmailSchema))),
      getEmailDetails: z
        .function()
        .args(z.string())
        .returns(z.promise(EmailDetailsSchema)),
      checkAuthStatus: z.function().returns(z.promise(z.string().nullable())),
      logout: z.function().returns(z.promise(z.boolean())),
      ping: z.function().returns(z.promise(z.string())),
    });

    PartialElectronAPISchema.parse(window.electronAPI);

    // Log a warning if getThreadEmails is missing
    if (typeof window.electronAPI.getThreadEmails !== "function") {
      console.warn("getThreadEmails method is missing from electronAPI");
    }

    return true;
  } catch (error) {
    console.error("Electron API validation failed:", error);
    return false;
  }
};
