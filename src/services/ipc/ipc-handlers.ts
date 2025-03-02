/**
 * ipc-handlers.ts
 *
 * Centralizes all IPC (Inter-Process Communication) handlers for the Electron main process.
 * This file contains all the functions that respond to requests from the renderer process.
 */

import { ipcMain } from "electron";
import ElectronStore from "electron-store";
import { EmailService } from "../api/email-service";
import { authenticate } from "../auth/auth-service";

// Initialize electron-store for secure, persistent token storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new ElectronStore() as any;

/**
 * Creates an EmailService instance with the authenticated client
 * @returns {Promise<EmailService>} Initialized EmailService
 */
async function createEmailService(): Promise<EmailService> {
  const auth = await authenticate();
  return new EmailService(auth);
}

/**
 * Registers all IPC handlers with Electron
 * This function should be called once when the app starts
 */
export function registerIpcHandlers(): void {
  /**
   * IPC handler for Google login request from renderer.
   * Authenticates the user and returns their email address as confirmation.
   */
  ipcMain.handle("login-with-google", async () => {
    try {
      const emailService = await createEmailService();
      return emailService.getUserEmail();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Login failed: ${errorMessage}`);
    }
  });

  /**
   * IPC handler to check if the user is already authenticated.
   * Returns the user's email if authenticated, null otherwise.
   */
  ipcMain.handle("check-auth-status", async () => {
    try {
      // Check if we have stored tokens
      const tokens = store.get("googleToken");
      if (!tokens) {
        console.log("No stored tokens found");
        return null;
      }

      // Try to use the tokens to get user profile
      const emailService = await createEmailService();
      const email = await emailService.getUserEmail();
      console.log("User is already authenticated:", email);
      return email;
    } catch (error: unknown) {
      console.error("Error checking auth status:", error);
      // If there's an error (e.g., invalid/expired token), clear tokens
      store.delete("googleToken");
      return null;
    }
  });

  /**
   * IPC handler to log out the user by clearing stored tokens.
   */
  ipcMain.handle("logout", () => {
    try {
      store.delete("googleToken");
      console.log("User logged out, tokens cleared");
      return true;
    } catch (error: unknown) {
      console.error("Error during logout:", error);
      return false;
    }
  });

  /**
   * IPC handler to fetch a list of recent emails after authentication.
   */
  ipcMain.handle("get-emails", async (_, maxResults = 10) => {
    try {
      const emailService = await createEmailService();
      return emailService.getEmails(maxResults);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch emails: ${errorMessage}`);
    }
  });

  /**
   * IPC handler to fetch email details
   */
  ipcMain.handle("get-email-details", async (_, emailId) => {
    try {
      const emailService = await createEmailService();
      return emailService.getEmailDetails(emailId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch email details: ${errorMessage}`);
    }
  });

  /**
   * IPC handler to fetch emails in a thread
   */
  ipcMain.handle("get-thread-emails", async (_, threadId, maxResults = 20) => {
    try {
      const emailService = await createEmailService();
      return emailService.getThreadEmails(threadId, maxResults);
    } catch (error) {
      console.error("Failed to fetch thread emails:", error);
      throw new Error(
        `Failed to fetch thread emails: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  /**
   * IPC handler to delete an email
   */
  ipcMain.handle("delete-email", async (_, emailId) => {
    try {
      const emailService = await createEmailService();
      return emailService.deleteEmail(emailId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete email: ${errorMessage}`);

      // Check for specific error types to provide better error messages
      if (errorMessage.includes("insufficient authentication scopes")) {
        // Clear stored tokens so the user can log in again with the correct permissions
        store.delete("googleToken");
        throw new Error(
          `Insufficient Permission: The app needs additional permissions to delete emails. Please log out and log in again.`
        );
      }

      throw new Error(`Failed to delete email: ${errorMessage}`);
    }
  });

  /**
   * IPC handler to mark an email as read
   */
  ipcMain.handle("mark-email-as-read", async (_, emailId) => {
    try {
      const emailService = await createEmailService();
      return emailService.markEmailAsRead(emailId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to mark email as read: ${errorMessage}`);

      // Check for specific error types to provide better error messages
      if (errorMessage.includes("insufficient authentication scopes")) {
        // Clear stored tokens so the user can log in again with the correct permissions
        store.delete("googleToken");
        throw new Error(
          `Insufficient Permission: The app needs additional permissions to modify emails. Please log out and log in again.`
        );
      }

      throw new Error(`Failed to mark email as read: ${errorMessage}`);
    }
  });
}
