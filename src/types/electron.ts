import { z } from "zod";
import { BasicEmailSchema, EmailDetailsSchema } from "./email";

// Electron API Schema
export const ElectronAPISchema = z.object({
  storeSet: z
    .function()
    .args(z.string(), z.string())
    .returns(z.promise(z.string())),
  storeGet: z.function().args(z.string()).returns(z.promise(z.string())),
  loginWithGoogle: z.function().returns(z.promise(z.string())),
  getEmails: z
    .function()
    .args(z.number().optional())
    .returns(z.promise(z.array(BasicEmailSchema))),
  getEmailDetails: z
    .function()
    .args(z.string())
    .returns(z.promise(EmailDetailsSchema)),
  getThreadEmails: z
    .function()
    .args(z.string(), z.number().optional())
    .returns(z.promise(z.array(EmailDetailsSchema))),
  checkAuthStatus: z.function().returns(z.promise(z.string().nullable())),
  logout: z.function().returns(z.promise(z.boolean())),
  deleteEmail: z.function().args(z.string()).returns(z.promise(z.boolean())),
  markEmailAsRead: z
    .function()
    .args(z.string())
    .returns(
      z.promise(
        z.object({
          success: z.boolean(),
          wasUnread: z.boolean().optional(),
        })
      )
    ),
  ping: z.function().returns(z.promise(z.string())),
  testGmailConnection: z.function().returns(z.promise(z.boolean())),
  sendEmail: z
    .function()
    .args(
      z.object({
        to: z.string(),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string(),
        body: z.string(),
        isHtml: z.boolean().optional(),
        threadId: z.string().optional(),
      })
    )
    .returns(
      z.promise(
        z.object({
          success: z.boolean(),
          messageId: z.string().optional(),
        })
      )
    ),
  sendEmailReply: z
    .function()
    .args(
      z.object({
        emailId: z.string(),
        threadId: z.string(),
        content: z.string(),
        to: z.string(),
      })
    )
    .returns(
      z.promise(
        z.object({
          success: z.boolean(),
          messageId: z.string().optional(),
          error: z.string().optional(),
        })
      )
    ),
  toggleStarEmail: z
    .function()
    .args(z.string())
    .returns(
      z.promise(
        z.object({
          success: z.boolean(),
          isStarred: z.boolean(),
        })
      )
    ),
  searchEmails: z
    .function()
    .args(z.string())
    .returns(
      z.promise(
        z.array(
          z.object({
            id: z.string(),
            subject: z.string(),
            snippet: z.string(),
            from: z.string(),
            date: z.date(),
            isUnread: z.boolean(),
          })
        )
      )
    ),
});

// Export type derived from schema
export type ElectronAPI = z.infer<typeof ElectronAPISchema>;

// Declare global window interface with our ElectronAPI type
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
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

    // Log a warning if deleteEmail is missing
    if (typeof window.electronAPI.deleteEmail !== "function") {
      console.warn("deleteEmail method is missing from electronAPI");
    }

    // Log a warning if markEmailAsRead is missing
    if (typeof window.electronAPI.markEmailAsRead !== "function") {
      console.warn("markEmailAsRead method is missing from electronAPI");
    }

    // Log a warning if testGmailConnection is missing
    if (typeof window.electronAPI.testGmailConnection !== "function") {
      console.warn("testGmailConnection method is missing from electronAPI");
    }

    // Log a warning if sendEmail is missing
    if (typeof window.electronAPI.sendEmail !== "function") {
      console.warn("sendEmail method is missing from electronAPI");
    }

    // Log a warning if sendEmailReply is missing
    if (typeof window.electronAPI.sendEmailReply !== "function") {
      console.warn("sendEmailReply method is missing from electronAPI");
    }

    // Log a warning if toggleStarEmail is missing
    if (typeof window.electronAPI.toggleStarEmail !== "function") {
      console.warn("toggleStarEmail method is missing from electronAPI");
    }

    // Log a warning if searchEmails is missing
    if (typeof window.electronAPI.searchEmails !== "function") {
      console.warn("searchEmails method is missing from electronAPI");
    }

    return true;
  } catch (error) {
    console.error("Electron API validation failed:", error);
    return false;
  }
};
