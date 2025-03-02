import { EmailDetails } from "../../types";
import { getEnhancedEmailBody, decodeBase64 } from "../../services";

// Helper function to safely get email body
export const safeGetEmailBody = (email: EmailDetails | null): string => {
  if (!email) {
    return "<p>No email content available</p>";
  }

  try {
    // First check if the email has a direct body property
    if ((email as any).body) {
      const body = (email as any).body;

      // If body is a string, return it directly
      if (typeof body === "string") {
        return body || "<p>Email content is empty</p>";
      }

      // If body has html content, use that
      if (body.html) {
        return body.html || "<p>Email content is empty</p>";
      }

      // Otherwise use plain text with line breaks
      if (body.plain) {
        return `<div style="font-family: sans-serif; line-height: 1.6;">${body.plain.replace(
          /\n/g,
          "<br>"
        )}</div>`;
      }
    }

    // If no direct body, extract from payload
    if (email.payload) {
      // Direct access to HTML content in parts
      if (
        email.payload &&
        (email.payload as any).parts &&
        Array.isArray((email.payload as any).parts)
      ) {
        const parts = (email.payload as any).parts;

        // First try to find HTML content
        for (const part of parts) {
          if (part.mimeType === "text/html" && part.body && part.body.data) {
            const content = decodeBase64(part.body.data);
            return content || "<p>Email content is empty</p>";
          }

          // Check nested parts
          if (part.parts && Array.isArray(part.parts)) {
            for (const nestedPart of part.parts) {
              if (
                nestedPart.mimeType === "text/html" &&
                nestedPart.body &&
                nestedPart.body.data
              ) {
                const content = decodeBase64(nestedPart.body.data);
                return content || "<p>Email content is empty</p>";
              }
            }
          }
        }

        // If no HTML found, look for plain text
        for (const part of parts) {
          if (part.mimeType === "text/plain" && part.body && part.body.data) {
            const plainText = decodeBase64(part.body.data);
            return `<div style="font-family: sans-serif; line-height: 1.6;">${plainText.replace(
              /\n/g,
              "<br>"
            )}</div>`;
          }
        }
      }

      // If no parts or no content found in parts, try the main body
      if (email.payload.body && email.payload.body.data) {
        const content = decodeBase64(email.payload.body.data);
        if (email.payload.mimeType === "text/html") {
          return content || "<p>Email content is empty</p>";
        } else {
          return `<div style="font-family: sans-serif; line-height: 1.6;">${content.replace(
            /\n/g,
            "<br>"
          )}</div>`;
        }
      }
    }

    // If all else fails, use getEnhancedEmailBody as a fallback
    const enhancedBody = getEnhancedEmailBody(email);
    return enhancedBody || "<p>Email content is empty</p>";
  } catch (error) {
    console.error("Error getting email body:", error);
    // If there's an error, return the snippet wrapped in a paragraph
    return email?.snippet
      ? `<p>${email.snippet}</p>`
      : "<p>Unable to display email content</p>";
  }
};
