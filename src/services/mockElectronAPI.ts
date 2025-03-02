/**
 * mockElectronAPI.ts
 *
 * This file provides a mock implementation of the Electron API for development mode.
 * It allows the application to run in a browser environment during development
 * without requiring the actual Electron runtime.
 */

import { EmailDetails, EmailHeader } from "../types";

/**
 * Initialize the mock Electron API in development mode
 */
export function initMockElectronAPI() {
  // Only initialize if we're in development mode and not in Electron
  if (process.env.NODE_ENV === "development" && !window.electronAPI) {
    console.log("Initializing mock Electron API for development mode");

    // Create a mock implementation of the Electron API
    window.electronAPI = {
      // Authentication methods
      loginWithGoogle: async () => {
        console.log("Mock: loginWithGoogle called");
        return "mock.user@example.com";
      },

      checkAuthStatus: async () => {
        console.log("Mock: checkAuthStatus called");
        return "mock.user@example.com";
      },

      logout: async () => {
        console.log("Mock: logout called");
        return true;
      },

      // Email methods
      getEmails: async (maxResults = 10) => {
        console.log(`Mock: getEmails called with maxResults=${maxResults}`);
        return generateMockBasicEmails(maxResults);
      },

      getEmailDetails: async (emailId: string) => {
        console.log(`Mock: getEmailDetails called with emailId=${emailId}`);
        return generateMockEmailDetails(emailId);
      },

      getThreadEmails: async (threadId: string, maxResults = 20) => {
        console.log(
          `Mock: getThreadEmails called with threadId=${threadId}, maxResults=${maxResults}`
        );
        return generateMockThreadEmails(threadId, maxResults);
      },

      deleteEmail: async (emailId: string) => {
        console.log(`Mock: deleteEmail called with emailId=${emailId}`);
        return true;
      },

      markEmailAsRead: async (emailId: string) => {
        console.log(`Mock: markEmailAsRead called with emailId=${emailId}`);
        return { success: true, wasUnread: true };
      },

      toggleStarEmail: async (emailId: string) => {
        console.log(`Mock: toggleStarEmail called with emailId=${emailId}`);
        return { success: true, isStarred: true };
      },

      sendEmail: async (params: {
        to: string;
        cc?: string;
        bcc?: string;
        subject: string;
        body: string;
        isHtml?: boolean;
      }) => {
        console.log("Mock: sendEmail called with params:", params);
        return { success: true, messageId: "mock-message-id-" + Date.now() };
      },

      // New method for sending email replies
      sendEmailReply: async (params: {
        emailId: string;
        threadId: string;
        content: string;
        to: string;
      }) => {
        console.log("Mock: sendEmailReply called with params:", params);

        // Generate a mock message ID for the reply
        const messageId = "mock-reply-id-" + Date.now();

        // In a real implementation, this would add the reply to the thread
        // Here we're just simulating a successful reply

        // Log detailed information for debugging
        console.log(`Mock: Reply added to thread ${params.threadId}`);
        console.log(`Mock: Reply sent to ${params.to}`);
        console.log(
          `Mock: Reply content length: ${params.content.length} characters`
        );

        return {
          success: true,
          messageId,
          // Include additional information that might be helpful for debugging
          threadId: params.threadId,
        };
      },

      // Utility methods
      ping: async (...args: unknown[]) => {
        const message = typeof args[0] === "string" ? args[0] : "No message";
        console.log(`Mock: ping called with message=${message}`);
        return `Pong from mock API: ${message}`;
      },

      testGmailConnection: async () => {
        console.log("Mock: testGmailConnection called");
        return true;
      },

      searchEmails: async (query: string) => {
        console.log(`Mock: searchEmails called with query=${query}`);
        return generateMockSearchResults(5);
      },
    };
  }
}

// Helper functions to generate mock data

function generateMockBasicEmails(count: number) {
  const emails = [];
  for (let i = 0; i < count; i++) {
    emails.push({
      id: `mock-email-${i}`,
      threadId: `mock-thread-${i % 5}`, // Group emails into 5 threads
    });
  }
  return emails;
}

function generateMockSearchResults(count: number) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push({
      id: `mock-email-${i}`,
      subject: `Mock Email Subject ${i}`,
      snippet: `This is a mock email snippet ${i}`,
      from: "John Doe <sender@example.com>",
      date: new Date(Date.now() - i * 3600000),
      isUnread: i % 2 === 0,
    });
  }
  return results;
}

function createMockHeaders(): EmailHeader[] {
  return [
    { name: "From", value: "John Doe <sender@example.com>" },
    { name: "To", value: "recipient@example.com" },
    { name: "Subject", value: "Mock Email Subject" },
    { name: "Date", value: new Date().toISOString() },
  ];
}

function generateMockEmailDetails(emailId: string): EmailDetails {
  return {
    id: emailId,
    threadId: `thread-${emailId}`,
    labelIds: ["INBOX", "UNREAD"],
    snippet: "This is a mock email snippet with more details...",
    historyId: "12345",
    internalDate: `${Date.now()}`,
    sizeEstimate: 1024,
    payload: {
      mimeType: "multipart/alternative",
      headers: createMockHeaders(),
      body: { size: 0 },
      parts: [
        {
          mimeType: "text/plain",
          headers: createMockHeaders(),
          body: {
            data: Buffer.from(
              "This is the plain text version of the mock email."
            ).toString("base64"),
            size: 50,
          },
        },
        {
          mimeType: "text/html",
          headers: createMockHeaders(),
          body: {
            data: Buffer.from(
              "<div>This is the <b>HTML</b> version of the mock email.</div>"
            ).toString("base64"),
            size: 60,
          },
        },
      ],
    },
  };
}

function generateMockThreadEmails(threadId: string, count: number) {
  const emails = [];
  for (let i = 0; i < Math.min(count, 5); i++) {
    // Create a mock email in the thread
    emails.push({
      id: `${threadId}-email-${i}`,
      threadId: threadId,
      labelIds: ["INBOX", i === 0 ? "UNREAD" : ""],
      snippet: `This is email ${i} in thread ${threadId}`,
      historyId: "12345",
      internalDate: `${Date.now() - i * 3600000}`,
      sizeEstimate: 1024,
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          {
            name: "From",
            value:
              i % 2 === 0
                ? "John Doe <sender@example.com>"
                : "You <you@example.com>",
          },
          {
            name: "To",
            value:
              i % 2 === 0 ? "you@example.com" : "John Doe <sender@example.com>",
          },
          {
            name: "Subject",
            value: i === 0 ? "Mock Thread Subject" : "Re: Mock Thread Subject",
          },
          {
            name: "Date",
            value: new Date(Date.now() - i * 3600000).toISOString(),
          },
        ],
        body: { size: 0 },
        parts: [
          {
            mimeType: "text/plain",
            headers: [
              { name: "Content-Type", value: "text/plain; charset=UTF-8" },
              { name: "Content-Transfer-Encoding", value: "base64" },
            ],
            body: {
              data: Buffer.from(
                `This is email ${i} in the thread. Plain text content.`
              ).toString("base64"),
              size: 50,
            },
          },
          {
            mimeType: "text/html",
            headers: [
              { name: "Content-Type", value: "text/html; charset=UTF-8" },
              { name: "Content-Transfer-Encoding", value: "base64" },
            ],
            body: {
              data: Buffer.from(
                `<div>This is email ${i} in the thread. <b>HTML</b> content.</div>`
              ).toString("base64"),
              size: 60,
            },
          },
        ],
      },
    });
  }
  return emails;
}
