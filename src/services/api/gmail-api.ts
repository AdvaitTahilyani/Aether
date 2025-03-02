/**
 * gmail-api.ts
 *
 * Core Gmail API service that provides direct access to Gmail API endpoints.
 * This service handles the low-level API calls to Gmail using Axios.
 */

import { AxiosInstance } from "axios";
import { OAuth2Client } from "google-auth-library";
import { createGmailApiClient } from "./axios-config";

/**
 * Gmail API Service class that provides methods to interact with Gmail API
 */
export class GmailApiService {
  private axiosInstance: AxiosInstance | null = null;
  private auth: OAuth2Client;

  /**
   * Creates a new GmailApiService instance
   *
   * @param auth - Authenticated OAuth2Client instance
   */
  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  /**
   * Initializes the Axios instance for API requests
   *
   * @returns Promise that resolves when the Axios instance is ready
   */
  async initialize(): Promise<void> {
    if (!this.axiosInstance) {
      this.axiosInstance = await createGmailApiClient(this.auth);
    }
  }

  /**
   * Tests the connection to the Gmail API
   *
   * @returns True if connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.initialize();
      // Make a simple request to check if the API is accessible
      await this.axiosInstance!.get("/users/me/profile");
      return true;
    } catch (error) {
      console.error("Gmail API connection test failed:", error);
      return false;
    }
  }

  /**
   * Gets the user's Gmail profile information
   *
   * @returns User profile data including email address
   */
  async getUserProfile(): Promise<{ emailAddress: string }> {
    await this.initialize();

    try {
      const response = await this.axiosInstance!.get("/users/me/profile");
      return response.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw new Error(
        `Failed to fetch user profile: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Lists messages (emails) in the user's mailbox
   *
   * @param maxResults - Maximum number of messages to return
   * @param query - Optional search query (same format as Gmail search)
   * @returns List of message objects with IDs and thread IDs
   */
  async listMessages(
    maxResults = 10,
    query?: string
  ): Promise<Array<{ id: string; threadId: string }>> {
    await this.initialize();

    try {
      const params: Record<string, string | number> = { maxResults };
      if (query) {
        params.q = query;
      }

      const response = await this.axiosInstance!.get("/users/me/messages", {
        params,
      });
      return response.data.messages || [];
    } catch (error) {
      console.error("Error listing messages:", error);
      throw new Error(
        `Failed to list messages: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Gets detailed information about a specific email
   *
   * @param messageId - ID of the message to retrieve
   * @param format - Format of the message (full, minimal, raw, metadata)
   * @returns Full message data including headers, body, etc.
   */
  async getMessage(messageId: string, format = "full"): Promise<any> {
    await this.initialize();

    try {
      const response = await this.axiosInstance!.get(
        `/users/me/messages/${messageId}`,
        {
          params: { format },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      throw new Error(
        `Failed to fetch message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Lists messages in a specific thread
   *
   * @param threadId - ID of the thread to retrieve messages from
   * @param maxResults - Maximum number of messages to return
   * @returns Array of full message objects in the thread
   */
  async getThreadMessages(threadId: string, maxResults = 20): Promise<any[]> {
    await this.initialize();

    try {
      // First, get the list of messages in the thread
      const messages = await this.listMessages(
        maxResults,
        `threadId:${threadId}`
      );

      if (!messages || messages.length === 0) {
        return [];
      }

      // Then get the details for each message
      const messageDetailsPromises = messages.map((message) =>
        this.getMessage(message.id)
      );

      // Wait for all message details to be fetched
      const messageDetails = await Promise.all(messageDetailsPromises);
      return messageDetails;
    } catch (error) {
      console.error(`Error fetching thread ${threadId}:`, error);
      throw new Error(
        `Failed to fetch thread messages: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Moves a message to trash
   *
   * @param messageId - ID of the message to trash
   * @returns Success status
   */
  async trashMessage(messageId: string): Promise<{ success: boolean }> {
    await this.initialize();

    try {
      await this.axiosInstance!.post(`/users/me/messages/${messageId}/trash`);
      return { success: true };
    } catch (error) {
      console.error(`Error trashing message ${messageId}:`, error);

      // Check for specific error types
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("insufficient authentication scopes")) {
        throw new Error(
          "Insufficient Permission: The app needs additional permissions to delete emails."
        );
      }

      throw new Error(`Failed to trash message: ${errorMessage}`);
    }
  }

  /**
   * Modifies the labels of a message
   *
   * @param messageId - ID of the message to modify
   * @param addLabelIds - Array of label IDs to add
   * @param removeLabelIds - Array of label IDs to remove
   * @returns Modified message data
   */
  async modifyMessageLabels(
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = []
  ): Promise<any> {
    await this.initialize();

    try {
      const response = await this.axiosInstance!.post(
        `/users/me/messages/${messageId}/modify`,
        {
          addLabelIds,
          removeLabelIds,
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error modifying labels for message ${messageId}:`, error);

      // Check for specific error types
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("insufficient authentication scopes")) {
        throw new Error(
          "Insufficient Permission: The app needs additional permissions to modify emails."
        );
      }

      throw new Error(`Failed to modify message labels: ${errorMessage}`);
    }
  }

  /**
   * Sends an email using the Gmail API
   *
   * @param rawEmail - Base64url encoded email content
   * @returns The sent message data including ID
   */
  async sendEmail({
    raw,
    to,
    cc,
    bcc,
    threadId,
  }: {
    raw: string;
    to: string;
    cc: string[];
    bcc: string[];
    threadId?: string;
  }): Promise<any> {
    await this.initialize();

    try {
      console.log("GmailAPI.sendEmail called with parameters:", {
        rawLength: raw?.length || 0,
        to,
        cc: cc?.length || 0,
        bcc: bcc?.length || 0,
        threadId,
      });

      // Validate parameters
      if (!raw) {
        throw new Error("Raw email content is required");
      }

      if (!to || typeof to !== "string") {
        console.error("Invalid 'to' parameter:", to);
        throw new Error(`Invalid recipient email: ${to}`);
      }

      // Ensure cc and bcc are arrays
      const ccArray = Array.isArray(cc) ? cc : [];
      const bccArray = Array.isArray(bcc) ? bcc : [];

      const requestBody: any = { raw };

      // Add threadId to the request if provided
      if (threadId) {
        requestBody.threadId = threadId;
      }

      console.log("Sending email with request body:", {
        rawLength: raw.length,
        hasThreadId: !!threadId,
      });

      const response = await this.axiosInstance!.post(
        "/users/me/messages/send",
        requestBody
      );

      console.log("Email sent successfully:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error(
        `Failed to send email: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
