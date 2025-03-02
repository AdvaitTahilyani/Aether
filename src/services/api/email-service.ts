/**
 * email-service.ts
 *
 * High-level email service that provides business logic and operations for email management.
 * This service uses the GmailApiService for the actual API calls and adds additional
 * functionality like parsing, formatting, and caching.
 */

import { OAuth2Client } from "google-auth-library";
import { GmailApiService } from "./gmail-api";

/**
 * Interface for email header information
 */
export interface EmailHeader {
  name: string;
  value: string;
}

/**
 * Interface for email metadata
 */
export interface EmailMetadata {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  sizeEstimate: number;
}

/**
 * Interface for parsed email data
 */
export interface ParsedEmail extends EmailMetadata {
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: Date;
  body: {
    plain: string;
    html: string | null;
  };
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  headers: EmailHeader[];
}

/**
 * Email Service class that provides high-level email operations
 */
export class EmailService {
  private gmailApi: GmailApiService;

  /**
   * Creates a new EmailService instance
   *
   * @param auth - Authenticated OAuth2Client instance
   */
  constructor(auth: OAuth2Client) {
    this.gmailApi = new GmailApiService(auth);
  }

  /**
   * Gets the user's email address
   *
   * @returns User's email address
   */
  async getUserEmail(): Promise<string> {
    const profile = await this.gmailApi.getUserProfile();
    return profile.emailAddress;
  }

  /**
   * Tests the connection to the Gmail API
   *
   * @returns True if connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.gmailApi.testConnection();
    } catch (error) {
      console.error("Email service connection test failed:", error);
      return false;
    }
  }

  /**
   * Fetches a list of emails with basic information
   *
   * @param maxResults - Maximum number of emails to fetch
   * @param query - Optional search query (Gmail search format)
   * @returns Array of email IDs and thread IDs
   */
  async getEmails(
    maxResults = 10,
    query?: string
  ): Promise<Array<{ id: string; threadId: string }>> {
    try {
      console.log(
        `Fetching up to ${maxResults} emails with query: ${query || "none"}`
      );
      const emails = await this.gmailApi.listMessages(maxResults, query);
      console.log(`Successfully fetched ${emails.length} emails`);
      return emails;
    } catch (error) {
      console.error("Error fetching emails:", error);
      throw error;
    }
  }

  /**
   * Fetches and parses a single email
   *
   * @param emailId - ID of the email to fetch
   * @returns Parsed email with all relevant information
   */
  async getEmailDetails(emailId: string): Promise<ParsedEmail> {
    try {
      console.log(`Fetching details for email ${emailId}...`);
      const rawEmail = await this.gmailApi.getMessage(emailId);
      console.log(`Successfully fetched raw email data for ${emailId}`);
      const parsedEmail = this.parseEmail(rawEmail);
      console.log(`Successfully parsed email ${emailId}`);
      return parsedEmail;
    } catch (error) {
      console.error(`Error fetching email details for ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches and parses all emails in a thread
   *
   * @param threadId - ID of the thread to fetch
   * @param maxResults - Maximum number of emails to fetch in the thread
   * @returns Array of parsed emails in the thread
   */
  async getThreadEmails(
    threadId: string,
    maxResults = 20
  ): Promise<ParsedEmail[]> {
    try {
      console.log(
        `Fetching up to ${maxResults} emails in thread ${threadId}...`
      );
      const rawEmails = await this.gmailApi.getThreadMessages(
        threadId,
        maxResults
      );
      console.log(
        `Successfully fetched ${rawEmails.length} emails in thread ${threadId}`
      );
      return rawEmails.map((email) => this.parseEmail(email));
    } catch (error) {
      console.error(`Error fetching thread emails for ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes an email by moving it to trash
   *
   * @param emailId - ID of the email to delete
   * @returns Success status
   */
  async deleteEmail(emailId: string): Promise<{ success: boolean }> {
    return this.gmailApi.trashMessage(emailId);
  }

  /**
   * Marks an email as read by removing the UNREAD label
   *
   * @param emailId - ID of the email to mark as read
   * @returns Success status and whether the email was previously unread
   */
  async markEmailAsRead(
    emailId: string
  ): Promise<{ success: boolean; wasUnread: boolean }> {
    try {
      // First, get the current email to check if it has the UNREAD label
      const email = await this.gmailApi.getMessage(emailId, "minimal");
      const hasUnreadLabel =
        email.labelIds && email.labelIds.includes("UNREAD");

      if (hasUnreadLabel) {
        // Remove the UNREAD label
        await this.gmailApi.modifyMessageLabels(emailId, [], ["UNREAD"]);
        return { success: true, wasUnread: true };
      }

      // Email was already read
      return { success: true, wasUnread: false };
    } catch (error) {
      console.error(`Error marking email ${emailId} as read:`, error);
      throw error;
    }
  }

  /**
   * Toggles the star status of an email
   *
   * @param emailId - ID of the email to toggle star status
   * @returns Object indicating success and the new star status
   */
  async toggleStarEmail(
    emailId: string
  ): Promise<{ success: boolean; isStarred: boolean }> {
    try {
      // First, get the current email to check if it's already starred
      const email = await this.getEmailDetails(emailId);
      const isCurrentlyStarred = email.labelIds?.includes("STARRED") || false;

      // Prepare the label modifications based on current state
      const addLabelIds = isCurrentlyStarred ? [] : ["STARRED"];
      const removeLabelIds = isCurrentlyStarred ? ["STARRED"] : [];

      // Call the Gmail API to modify the labels
      await this.gmailApi.modifyMessageLabels(
        emailId,
        addLabelIds,
        removeLabelIds
      );

      // Return the new star status (opposite of the current status)
      return {
        success: true,
        isStarred: !isCurrentlyStarred,
      };
    } catch (error) {
      console.error(`Error toggling star for email ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Parses a raw email from the Gmail API into a more usable format
   * with enhanced error handling and support for complex email structures
   *
   * @param rawEmail - Raw email data from Gmail API
   * @returns Parsed email with extracted fields
   */
  private parseEmail(rawEmail: any): ParsedEmail {
    try {
      // Validate the email object
      if (!rawEmail || typeof rawEmail !== "object") {
        console.error("Invalid email object received (null or not an object)");
        return this.createFallbackEmail("unknown");
      }

      if (!rawEmail.id) {
        console.error("Email object missing ID:", rawEmail);
        return this.createFallbackEmail("unknown");
      }

      const emailId = rawEmail.id;
      console.log(`Parsing email ${emailId}...`);

      // Check if we have a valid payload
      if (!rawEmail.payload) {
        console.error(`Email ${emailId} missing payload:`, rawEmail);
        return this.createFallbackEmail(emailId, rawEmail.threadId);
      }

      // Extract headers with error handling
      const headers: EmailHeader[] = Array.isArray(rawEmail.payload.headers)
        ? rawEmail.payload.headers
        : [];

      // Helper function to find header value
      const getHeader = (name: string): string => {
        try {
          const header = headers.find(
            (h) => h.name.toLowerCase() === name.toLowerCase()
          );
          return header ? header.value : "";
        } catch (error) {
          console.error(`Error getting header ${name}:`, error);
          return "";
        }
      };

      // Extract basic metadata with fallbacks
      const metadata: EmailMetadata = {
        id: emailId,
        threadId: rawEmail.threadId || emailId, // Fallback to ID if threadId is missing
        labelIds: Array.isArray(rawEmail.labelIds) ? rawEmail.labelIds : [],
        snippet: rawEmail.snippet || "",
        historyId: rawEmail.historyId || "",
        internalDate: rawEmail.internalDate || Date.now().toString(),
        sizeEstimate:
          typeof rawEmail.sizeEstimate === "number" ? rawEmail.sizeEstimate : 0,
      };

      // Parse recipients (to, cc, bcc) with enhanced error handling
      const parseRecipients = (headerValue: string): string[] => {
        try {
          if (!headerValue) return [];

          // Split by commas, but handle cases where commas are in quotes
          const recipients: string[] = [];
          let currentRecipient = "";
          let inQuotes = false;

          for (let i = 0; i < headerValue.length; i++) {
            const char = headerValue[i];

            if (char === '"') {
              inQuotes = !inQuotes;
              currentRecipient += char;
            } else if (char === "," && !inQuotes) {
              recipients.push(currentRecipient.trim());
              currentRecipient = "";
            } else {
              currentRecipient += char;
            }
          }

          if (currentRecipient.trim()) {
            recipients.push(currentRecipient.trim());
          }

          return recipients;
        } catch (error) {
          console.error(
            `Error parsing recipients from "${headerValue}":`,
            error
          );
          return [];
        }
      };

      // Extract email body parts with enhanced error handling
      const bodies = { plain: "", html: null as string | null };

      // Recursive function to extract body content from all parts
      const extractBody = (
        part: any,
        bodies: { plain: string; html: string | null },
        depth = 0
      ): void => {
        try {
          if (!part) return;

          // Prevent infinite recursion
          if (depth > 10) {
            console.warn(
              `Reached maximum recursion depth (10) while parsing email ${emailId}`
            );
            return;
          }

          // Log the part structure for debugging
          if (depth === 0) {
            console.log(
              `Email ${emailId} part structure:`,
              JSON.stringify({
                mimeType: part.mimeType,
                filename: part.filename,
                hasBody: !!part.body,
                hasBodyData: !!(part.body && part.body.data),
                hasBodyAttachmentId: !!(part.body && part.body.attachmentId),
                hasParts: !!(part.parts && part.parts.length),
                partsCount: part.parts ? part.parts.length : 0,
              })
            );
          }

          // Handle direct body content
          if (part.body?.data) {
            try {
              const decodedContent = Buffer.from(
                part.body.data,
                "base64"
              ).toString("utf-8");

              if (part.mimeType === "text/plain") {
                bodies.plain = bodies.plain
                  ? bodies.plain + "\n" + decodedContent
                  : decodedContent;
              } else if (part.mimeType === "text/html") {
                bodies.html = bodies.html
                  ? bodies.html + decodedContent
                  : decodedContent;
              } else if (
                part.mimeType &&
                part.mimeType.startsWith("multipart/")
              ) {
                // For multipart content, add to plain text as fallback
                if (!bodies.plain) {
                  bodies.plain = decodedContent;
                }
              }
            } catch (error) {
              console.error(
                `Error decoding body content for email ${emailId}:`,
                error
              );
            }
          }

          // Handle multipart messages
          if (part.parts && Array.isArray(part.parts)) {
            // Recursively process multipart messages
            part.parts.forEach((subpart: any) =>
              extractBody(subpart, bodies, depth + 1)
            );
          }

          // Handle special case for multipart/alternative without explicit parts array
          if (
            part.mimeType &&
            part.mimeType.startsWith("multipart/") &&
            !part.parts &&
            part.body
          ) {
            // Try to extract content from the body directly
            if (part.body.data) {
              try {
                const content = Buffer.from(part.body.data, "base64").toString(
                  "utf-8"
                );
                bodies.plain = bodies.plain
                  ? bodies.plain + "\n" + content
                  : content;
              } catch (error) {
                console.error(
                  `Error decoding multipart body for email ${emailId}:`,
                  error
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `Error extracting body at depth ${depth} for email ${emailId}:`,
            error
          );
        }
      };

      // Process the email payload
      if (rawEmail.payload) {
        extractBody(rawEmail.payload, bodies);
      }

      // If we still don't have any content, use the snippet as fallback
      if (!bodies.plain && !bodies.html && rawEmail.snippet) {
        bodies.plain = rawEmail.snippet;
      }

      // Extract attachments with enhanced error handling
      const attachments: Array<{
        filename: string;
        mimeType: string;
        size: number;
        attachmentId: string;
      }> = [];

      // Recursive function to find attachments in all parts
      const findAttachments = (part: any, depth = 0): void => {
        try {
          if (!part) return;

          // Prevent infinite recursion
          if (depth > 10) return;

          // Check if this part is an attachment
          if (
            part.filename &&
            part.body &&
            part.body.attachmentId &&
            !part.mimeType?.startsWith("multipart/")
          ) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || "application/octet-stream",
              size: part.body.size || 0,
              attachmentId: part.body.attachmentId,
            });
          }

          // Check nested parts
          if (part.parts && Array.isArray(part.parts)) {
            part.parts.forEach((subpart: any) =>
              findAttachments(subpart, depth + 1)
            );
          }
        } catch (error) {
          console.error(
            `Error finding attachments at depth ${depth} for email ${emailId}:`,
            error
          );
        }
      };

      // Find attachments in the email payload
      if (rawEmail.payload) {
        findAttachments(rawEmail.payload);
      }

      // Parse date from internalDate with fallback
      let emailDate: Date;
      try {
        // Use internalDate (timestamp in milliseconds) as the most reliable source
        emailDate = new Date(parseInt(rawEmail.internalDate) || Date.now());

        // Validate the date - if it's invalid, fall back to current date
        if (isNaN(emailDate.getTime())) {
          console.warn(
            `Invalid date for email ${emailId}, using current date as fallback`
          );
          emailDate = new Date();
        }
      } catch (error) {
        console.error(`Error parsing date for email ${emailId}:`, error);
        emailDate = new Date();
      }

      // Create the parsed email object
      const parsedEmail: ParsedEmail = {
        ...metadata,
        subject: getHeader("subject"),
        from: getHeader("from"),
        to: parseRecipients(getHeader("to")),
        cc: parseRecipients(getHeader("cc")),
        bcc: parseRecipients(getHeader("bcc")),
        date: emailDate,
        body: {
          plain: bodies.plain,
          html: bodies.html,
        },
        attachments,
        isUnread: rawEmail.labelIds?.includes("UNREAD") || false,
        isStarred: rawEmail.labelIds?.includes("STARRED") || false,
        isImportant: rawEmail.labelIds?.includes("IMPORTANT") || false,
        headers,
      };

      console.log(`Successfully parsed email ${emailId}`);
      return parsedEmail;
    } catch (error) {
      console.error("Error parsing email:", error);
      // Return a minimal valid email object
      return this.createFallbackEmail(
        rawEmail?.id || "unknown",
        rawEmail?.threadId || "unknown",
        rawEmail?.snippet
      );
    }
  }

  /**
   * Creates a fallback email object when parsing fails
   *
   * @param id - Email ID
   * @param threadId - Thread ID (defaults to email ID)
   * @param snippet - Email snippet (defaults to error message)
   * @returns A minimal valid email object
   */
  private createFallbackEmail(
    id: string,
    threadId?: string,
    snippet?: string
  ): ParsedEmail {
    console.log(`Creating fallback email for ${id}`);
    return {
      id: id,
      threadId: threadId || id,
      labelIds: [],
      snippet: snippet || "Error parsing email",
      historyId: "",
      internalDate: Date.now().toString(),
      sizeEstimate: 0,
      subject: "Error parsing email",
      from: "unknown@example.com",
      to: [],
      cc: [],
      bcc: [],
      date: new Date(),
      body: {
        plain:
          "Error parsing email content. The email may have an unsupported format.",
        html: null,
      },
      attachments: [],
      isUnread: false,
      isStarred: false,
      isImportant: false,
      headers: [],
    };
  }

  /**
   * Sends an email using the Gmail API
   *
   * @param to - Recipient email address
   * @param cc - CC recipients (comma-separated string)
   * @param bcc - BCC recipients (comma-separated string)
   * @param subject - Email subject
   * @param body - Email body content
   * @param isHtml - Whether the body is HTML (default: false)
   * @param threadId - Optional thread ID to add the email to a specific thread
   * @returns Object with success status and message ID if successful
   */
  async sendEmail(
    to: string,
    cc: string = "",
    bcc: string = "",
    subject: string,
    body: string,
    isHtml = false,
    threadId?: string
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Get the user's email address to use as the sender
      const from = await this.getUserEmail();

      // Construct the email headers
      let emailContent = "";
      emailContent += `From: ${from}\r\n`;
      emailContent += `To: ${to}\r\n`;

      // Add CC and BCC headers if provided
      if (cc) {
        emailContent += `Cc: ${cc}\r\n`;
      }

      if (bcc) {
        emailContent += `Bcc: ${bcc}\r\n`;
      }

      emailContent += `Subject: ${subject}\r\n`;
      emailContent += `MIME-Version: 1.0\r\n`;

      if (isHtml) {
        emailContent += `Content-Type: text/html; charset=utf-8\r\n`;
      } else {
        emailContent += `Content-Type: text/plain; charset=utf-8\r\n`;
      }

      // Separate headers from the body with a blank line
      emailContent += `\r\n${body}`;

      // Encode the email content to base64url format
      const encodedEmail = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Parse CC and BCC recipients into arrays
      const ccArray = cc ? cc.split(",").map((email) => email.trim()) : [];
      const bccArray = bcc ? bcc.split(",").map((email) => email.trim()) : [];

      // Send the email using the Gmail API
      const result = await this.gmailApi.sendEmail({
        raw: encodedEmail,
        to,
        cc: ccArray,
        bcc: bccArray,
        threadId, // Pass the threadId if provided
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error("Failed to send email:", error);
      return {
        success: false,
      };
    }
  }

  /**
   * Sends a reply to an email
   * @param emailId - The ID of the email to reply to
   * @param threadId - The ID of the thread the email belongs to
   * @param content - The content of the reply
   * @param to - The recipient of the reply
   * @returns A success message and the message ID
   */
  async sendEmailReply({
    emailId,
    threadId,
    content,
    to,
  }: {
    emailId: string;
    threadId: string;
    content: string;
    to: string;
  }): Promise<{ success: boolean; messageId: string }> {
    try {
      console.log("sendEmailReply called with parameters:", {
        emailId,
        threadId,
        contentLength: content.length,
        to,
      });

      if (!to || typeof to !== "string" || !to.includes("@")) {
        console.error("Invalid recipient email:", to);
        throw new Error(`Invalid recipient email: ${to}`);
      }

      // Get the original email to extract headers
      const originalEmail = await this.gmailApi.getMessage(emailId);

      // Get the user's email address
      const userProfile = await this.gmailApi.getUserProfile();

      // Extract message ID and references from the original email
      const headers = originalEmail.payload.headers;

      // Find the Message-ID header, ensuring it has angle brackets
      let messageId = headers.find(
        (h: any) => h.name === "Message-ID" || h.name === "Message-Id"
      )?.value;
      if (!messageId) {
        // If no Message-ID found, generate one based on the email ID
        messageId = `<${emailId}@mail.gmail.com>`;
        console.log(`No Message-ID found, generated: ${messageId}`);
      } else if (!messageId.includes("<")) {
        messageId = `<${messageId}>`;
      }

      // Find the References header, ensuring it has angle brackets
      let references =
        headers.find((h: any) => h.name === "References")?.value || "";
      if (references && !references.includes("<")) {
        references = references
          .split(/\s+/)
          .map((ref: string) => `<${ref}>`)
          .join(" ");
      }

      // Get the subject, ensuring it has "Re:" prefix
      let subject = headers.find((h: any) => h.name === "Subject")?.value || "";
      if (!subject) {
        subject = "Re: No Subject";
        console.log("No subject found, using default");
      } else if (!subject.startsWith("Re:")) {
        subject = `Re: ${subject}`;
      }

      console.log(`Preparing reply with subject: ${subject}`);
      console.log(`In-Reply-To: ${messageId}`);
      console.log(
        `References: ${references ? `${references} ${messageId}` : messageId}`
      );

      // Create email headers
      const emailHeaders = [
        `From: ${userProfile.emailAddress}`,
        `To: ${to}`,
        `Subject: ${subject}`,
      ];

      // Add In-Reply-To header if we have a Message-ID
      if (messageId) {
        emailHeaders.push(`In-Reply-To: ${messageId}`);
      }

      // Add References header, appending the Message-ID if it exists
      if (messageId) {
        const newReferences = references
          ? `${references} ${messageId}`
          : messageId;
        emailHeaders.push(`References: ${newReferences}`);
      }

      // Add MIME headers
      emailHeaders.push(
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8"
      );

      // Join headers
      const headerString = emailHeaders.join("\r\n");

      // Create email body with quoted original content
      let emailBody = `<div>${content}</div>`;

      // Add a quote of the original message if available
      const originalPlainText = this.extractPlainTextContent(originalEmail);
      if (originalPlainText) {
        emailBody += `<br><br><div style="border-left: 1px solid #ccc; padding-left: 10px; color: #666;">
          <p>On ${new Date(
            parseInt(originalEmail.internalDate)
          ).toLocaleString()}, ${to} wrote:</p>
          <p>${originalPlainText.replace(/\n/g, "<br>")}</p>
        </div>`;
      }

      // Combine headers and body
      const emailContent = `${headerString}\r\n\r\n${emailBody}`;

      console.log("Email content prepared, encoding and sending...");

      // Encode the email content to base64url format
      const encodedEmail = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send the email using the Gmail API
      const result = await this.gmailApi.sendEmail({
        raw: encodedEmail,
        to,
        cc: [],
        bcc: [],
        threadId: threadId, // Pass the threadId to ensure it's added to the correct thread
      });

      console.log(`Email reply sent successfully! Message ID: ${result.id}`);
      console.log(`Thread ID: ${threadId}`);
      console.log(`Recipient: ${to}`);
      console.log(`Email headers: ${headerString.substring(0, 200)}...`);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error("Error sending email reply:", error);
      // Add more detailed error information
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error details: ${errorMessage}`);

      // Log the parameters that were used
      console.error("Parameters used:", {
        emailId,
        threadId,
        contentLength: content?.length || 0,
        to,
      });

      throw new Error(
        `Failed to send email reply: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extracts plain text content from an email
   * @param email - The email object
   * @returns The plain text content of the email
   */
  private extractPlainTextContent(email: any): string {
    try {
      // If the email has no payload or parts, return empty string
      if (!email.payload || (!email.payload.body && !email.payload.parts)) {
        return "";
      }

      // If the email has a body with data, decode and return it
      if (email.payload.body && email.payload.body.data) {
        return Buffer.from(email.payload.body.data, "base64").toString("utf-8");
      }

      // If the email has parts, look for text/plain part
      if (email.payload.parts) {
        for (const part of email.payload.parts) {
          if (part.mimeType === "text/plain" && part.body && part.body.data) {
            return Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }

        // If no text/plain part, try to find any part with data
        for (const part of email.payload.parts) {
          if (part.body && part.body.data) {
            return Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }
      }

      return "";
    } catch (error) {
      console.error("Error extracting plain text content:", error);
      return "";
    }
  }
}
