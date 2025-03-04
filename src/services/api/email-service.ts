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
      const emails = await this.gmailApi.listMessages(maxResults, query);
      return emails;
    } catch (error) {
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
      const rawEmail = await this.gmailApi.getMessage(emailId);
      const parsedEmail = this.parseEmail(rawEmail);
      return parsedEmail;
    } catch (error) {
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
      const rawEmails = await this.gmailApi.getThreadMessages(
        threadId,
        maxResults
      );
      return rawEmails.map((email) => this.parseEmail(email));
    } catch (error) {
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
      const email = await this.gmailApi.getMessage(emailId, "minimal");
      const hasUnreadLabel =
        email.labelIds && email.labelIds.includes("UNREAD");

      if (hasUnreadLabel) {
        await this.gmailApi.modifyMessageLabels(emailId, [], ["UNREAD"]);
        return { success: true, wasUnread: true };
      }

      return { success: true, wasUnread: false };
    } catch (error) {
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
      const email = await this.getEmailDetails(emailId);
      const isCurrentlyStarred = email.labelIds?.includes("STARRED") || false;

      const addLabelIds = isCurrentlyStarred ? [] : ["STARRED"];
      const removeLabelIds = isCurrentlyStarred ? ["STARRED"] : [];

      await this.gmailApi.modifyMessageLabels(
        emailId,
        addLabelIds,
        removeLabelIds
      );

      return {
        success: true,
        isStarred: !isCurrentlyStarred,
      };
    } catch (error) {
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
        return this.createFallbackEmail("unknown");
      }

      if (!rawEmail.id) {
        return this.createFallbackEmail("unknown");
      }

      const emailId = rawEmail.id;

      // Check if we have a valid payload
      if (!rawEmail.payload) {
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
            return;
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
            } catch (error) {}
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
              } catch (error) {}
            }
          }
        } catch (error) {}
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
        } catch (error) {}
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
          emailDate = new Date();
        }
      } catch (error) {
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

      return parsedEmail;
    } catch (error) {
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
      const from = await this.getUserEmail();

      let emailContent = "";
      emailContent += `From: ${from}\r\n`;
      emailContent += `To: ${to}\r\n`;

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

      emailContent += `\r\n${body}`;

      const encodedEmail = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const ccArray = cc ? cc.split(",").map((email) => email.trim()) : [];
      const bccArray = bcc ? bcc.split(",").map((email) => email.trim()) : [];

      const result = await this.gmailApi.sendEmail({
        raw: encodedEmail,
        to,
        cc: ccArray,
        bcc: bccArray,
        threadId,
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
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
      if (!to || typeof to !== "string" || !to.includes("@")) {
        throw new Error(`Invalid recipient email: ${to}`);
      }

      const originalEmail = await this.gmailApi.getMessage(emailId);
      const userProfile = await this.gmailApi.getUserProfile();
      const headers = originalEmail.payload.headers;

      let messageId = headers.find(
        (h: any) => h.name === "Message-ID" || h.name === "Message-Id"
      )?.value;
      if (!messageId) {
        messageId = `<${emailId}@mail.gmail.com>`;
      } else if (!messageId.includes("<")) {
        messageId = `<${messageId}>`;
      }

      let references =
        headers.find((h: any) => h.name === "References")?.value || "";
      if (references && !references.includes("<")) {
        references = references
          .split(/\s+/)
          .map((ref: string) => `<${ref}>`)
          .join(" ");
      }

      let subject = headers.find((h: any) => h.name === "Subject")?.value || "";
      if (!subject) {
        subject = "Re: No Subject";
      } else if (!subject.startsWith("Re:")) {
        subject = `Re: ${subject}`;
      }

      const emailHeaders = [
        `From: ${userProfile.emailAddress}`,
        `To: ${to}`,
        `Subject: ${subject}`,
      ];

      if (messageId) {
        emailHeaders.push(`In-Reply-To: ${messageId}`);
      }

      if (messageId) {
        const newReferences = references
          ? `${references} ${messageId}`
          : messageId;
        emailHeaders.push(`References: ${newReferences}`);
      }

      emailHeaders.push(
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8"
      );

      const headerString = emailHeaders.join("\r\n");
      let emailBody = `<div>${content}</div>`;

      const originalPlainText = this.extractPlainTextContent(originalEmail);
      if (originalPlainText) {
        emailBody += `<br><br><div style="border-left: 1px solid #ccc; padding-left: 10px; color: #666;">
          <p>On ${new Date(
            parseInt(originalEmail.internalDate)
          ).toLocaleString()}, ${to} wrote:</p>
          <p>${originalPlainText.replace(/\n/g, "<br>")}</p>
        </div>`;
      }

      const emailContent = `${headerString}\r\n\r\n${emailBody}`;

      const encodedEmail = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const result = await this.gmailApi.sendEmail({
        raw: encodedEmail,
        to,
        cc: [],
        bcc: [],
        threadId: threadId,
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to send email reply: ${errorMessage}`);
    }
  }

  /**
   * Extracts plain text content from an email
   * @param email - The email object
   * @returns The plain text content of the email
   */
  private extractPlainTextContent(email: any): string {
    try {
      if (!email.payload || (!email.payload.body && !email.payload.parts)) {
        return "";
      }

      if (email.payload.body && email.payload.body.data) {
        return Buffer.from(email.payload.body.data, "base64").toString("utf-8");
      }

      if (email.payload.parts) {
        for (const part of email.payload.parts) {
          if (part.mimeType === "text/plain" && part.body && part.body.data) {
            return Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }

        for (const part of email.payload.parts) {
          if (part.body && part.body.data) {
            return Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }
      }

      return "";
    } catch (error) {
      return "";
    }
  }
}
