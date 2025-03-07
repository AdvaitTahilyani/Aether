import { ipcMain } from "electron";
import { createEmailService } from "../../../electron/main";
import { store } from "../../../electron/store";
/**
 * IPC handler to fetch a list of recent emails after authentication.
 * Demonstrates Gmail API usage with the stored token.
 */
export function registerGmailHandlers() {
  /**
   * IPC handler for Google login request from renderer.
   * Authenticates the user and returns their email address as confirmation.
   * Includes error handling to inform the renderer of failures.
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

  ipcMain.handle("sync-emails", async () => {
    const emailService = await createEmailService();
    if (!emailService) {
      throw new Error(
        "Failed to create email service - authentication may have failed"
      );
    }

    const gmailEmails = await emailService.getEmails(100);
  });

  ipcMain.handle("get-emails", async (_, maxResults = 10, query?: string) => {
    try {
      console.log(
        `Fetching up to ${maxResults} emails with query: ${query || "none"}`
      );
      const emailService = await createEmailService();

      if (!emailService) {
        throw new Error(
          "Failed to create email service - authentication may have failed"
        );
      }

      const emails = await emailService.getEmails(maxResults, query);
      console.log(`Successfully fetched ${emails.length} emails`);

      // Validate the email objects
      const validEmails = emails.filter(
        (email) => email && email.id && email.threadId
      );
      if (validEmails.length < emails.length) {
        console.warn(
          `Filtered out ${
            emails.length - validEmails.length
          } invalid email objects`
        );
      }

      return validEmails;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to fetch emails: ${errorMessage}`);
      console.error(error); // Log the full error object for debugging
      throw new Error(`Failed to fetch emails: ${errorMessage}`);
    }
  });

  // Add this IPC handler to fetch email details
  ipcMain.handle("get-email-details", async (_, emailId) => {
    try {
      if (!emailId) {
        throw new Error("Email ID is required");
      }

      console.log(`Fetching details for email ${emailId}...`);
      const emailService = await createEmailService();

      if (!emailService) {
        throw new Error(
          "Failed to create email service - authentication may have failed"
        );
      }

      const emailDetails = await emailService.getEmailDetails(emailId);

      // Validate the email details
      if (!emailDetails || !emailDetails.id) {
        throw new Error(`Invalid email details returned for ID: ${emailId}`);
      }

      console.log(`Successfully fetched details for email ${emailId}`);
      return emailDetails;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to fetch email details for ${emailId}: ${errorMessage}`
      );
      console.error(error); // Log the full error object for debugging
      throw new Error(`Failed to fetch email details: ${errorMessage}`);
    }
  });

  // Add this IPC handler to fetch emails in a thread
  ipcMain.handle("get-thread-emails", async (_, threadId, maxResults = 20) => {
    try {
      if (!threadId) {
        throw new Error("Thread ID is required");
      }

      console.log(
        `Fetching up to ${maxResults} emails in thread ${threadId}...`
      );
      const emailService = await createEmailService();

      if (!emailService) {
        throw new Error(
          "Failed to create email service - authentication may have failed"
        );
      }

      const threadEmails = await emailService.getThreadEmails(
        threadId,
        maxResults
      );
      console.log(
        `Successfully fetched ${threadEmails.length} emails in thread ${threadId}`
      );

      // Validate the email objects
      const validEmails = threadEmails.filter((email) => email && email.id);
      if (validEmails.length < threadEmails.length) {
        console.warn(
          `Filtered out ${
            threadEmails.length - validEmails.length
          } invalid email objects in thread`
        );
      }

      return validEmails;
    } catch (error) {
      console.error("Failed to fetch thread emails:", error);
      throw new Error(
        `Failed to fetch thread emails: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  // Add this IPC handler to delete an email
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
      throw new Error(`Failed to mark email as read: ${errorMessage}`);
    }
  });

  /**
   * IPC handler to send an email
   */
  ipcMain.handle(
    "send-email",
    async (
      _,
      { to, cc = "", bcc = "", subject, body, isHtml = false, threadId }
    ) => {
      try {
        console.log(`Sending email to ${to} with subject: ${subject}`);
        if (threadId) {
          console.log(`Adding to thread: ${threadId}`);
        }

        const emailService = await createEmailService();

        if (!emailService) {
          throw new Error(
            "Failed to create email service - authentication may have failed"
          );
        }

        const result = await emailService.sendEmail(
          to,
          cc,
          bcc,
          subject,
          body,
          isHtml,
          threadId
        );

        if (result.success) {
          console.log(`Successfully sent email with ID: ${result.messageId}`);
        } else {
          console.error("Failed to send email");
        }

        return result;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Failed to send email: ${errorMessage}`);

        // Check for specific error types to provide better error messages
        if (errorMessage.includes("insufficient authentication scopes")) {
          // Clear stored tokens so the user can log in again with the correct permissions
          store.delete("googleToken");
          throw new Error(
            `Insufficient Permission: The app needs additional permissions to send emails. Please log out and log in again.`
          );
        }

        throw new Error(`Failed to send email: ${errorMessage}`);
      }
    }
  );

  /**
   * IPC handler to toggle the star status of an email
   */
  ipcMain.handle("toggle-star-email", async (_, emailId) => {
    try {
      const emailService = await createEmailService();
      return emailService.toggleStarEmail(emailId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to toggle star status: ${errorMessage}`);

      // Check for permission errors
      if (
        errorMessage.includes("insufficient authentication scopes") ||
        errorMessage.includes("Insufficient Permission")
      ) {
        // Clear stored tokens so the user can log in again with the correct permissions
        store.delete("googleToken");
        throw new Error(
          `Insufficient Permission: The app needs additional permissions to modify emails. Please log out and log in again.`
        );
      }

      throw new Error(`Failed to toggle star status: ${errorMessage}`);
    }
  });

  /**
   * Simple ping handler to test IPC connection
   */
  ipcMain.handle("ping", async (_, message) => {
    console.log("Received ping from renderer:", message);
    return `Pong from main process at ${new Date().toISOString()}`;
  });

  /**
   * IPC handler to test Gmail API connection
   */
  ipcMain.handle("test-gmail-connection", async () => {
    try {
      console.log("Testing Gmail API connection...");
      const emailService = await createEmailService();
      const isConnected = await emailService.testConnection();
      console.log(
        `Gmail API connection test result: ${
          isConnected ? "Success" : "Failed"
        }`
      );
      return isConnected;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Gmail API connection test error: ${errorMessage}`);
      return false;
    }
  });

  /**
   * IPC handler to search emails with a query
   */
  ipcMain.handle("search-emails", async (_, query) => {
    try {
      console.log(`Searching emails with query: ${query}`);
      const emailService = await createEmailService();

      if (!emailService) {
        throw new Error(
          "Failed to create email service - authentication may have failed"
        );
      }

      // Get email IDs matching the search query
      const emailIds = await emailService.getEmails(50, query);

      if (!emailIds || emailIds.length === 0) {
        console.log("No emails found matching the query");
        return [];
      }

      console.log(`Found ${emailIds.length} emails matching the query`);

      // Get details for each email (limited to first 20 for performance)
      const maxToFetch = Math.min(emailIds.length, 20);
      const emailPromises = emailIds
        .slice(0, maxToFetch)
        .map(({ id }) => emailService.getEmailDetails(id));

      const emails = await Promise.all(emailPromises);

      // Return simplified email objects with just the needed fields
      return emails.map((email) => ({
        id: email.id,
        subject: email.subject,
        snippet: email.snippet,
        from: email.from,
        date: email.date,
        isUnread: email.isUnread,
      }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to search emails: ${errorMessage}`);
      throw new Error(`Failed to search emails: ${errorMessage}`);
    }
  });

  // Add this to the existing IPC handlers in the createWindow function
  ipcMain.handle("send-email-reply", async (_, args) => {
    try {
      const { emailId, threadId, content, to } = args;

      // Validate the 'to' parameter
      if (!to || typeof to !== "string" || !to.includes("@")) {
        console.error("Invalid recipient email:", to);
        return {
          success: false,
          error: `Invalid recipient email: ${to}`,
        };
      }

      // Create a new email service instance for this request
      const emailService = await createEmailService();

      if (!emailService) {
        console.error("Email service not initialized");
        return { success: false, error: "Email service not initialized" };
      }

      const result = await emailService.sendEmailReply({
        emailId,
        threadId,
        content,
        to,
      });

      return result;
    } catch (error) {
      console.error("Failed to send reply:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
