const { google } = require("googleapis");
const { getAuthClient } = require("../auth");
const { Buffer } = require("buffer");

/**
 * Handles sending email replies through the Gmail API
 *
 * @param {Object} options - Reply options
 * @param {string} options.threadId - Thread ID to reply to
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email body content (HTML)
 * @param {string} options.inReplyTo - Message ID being replied to
 * @param {string} options.references - References header for threading
 * @returns {Promise<Object>} Result of the operation
 */
async function handleSendEmailReply(options) {
  try {
    const { threadId, to, subject, body, inReplyTo, references } = options;

    // Get authenticated client
    const auth = await getAuthClient();
    if (!auth) {
      console.error("Authentication failed when trying to send email reply");
      return { success: false, error: "Authentication failed" };
    }

    // Create Gmail API client
    const gmail = google.gmail({ version: "v1", auth });

    // Get user's email address for the From field
    const profile = await gmail.users.getProfile({ userId: "me" });
    const from = profile.data.emailAddress;

    // Construct email headers
    const emailLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
    ];

    // Add threading headers if available
    if (inReplyTo) {
      emailLines.push(`In-Reply-To: <${inReplyTo}>`);
    }

    if (references) {
      emailLines.push(`References: <${references}>`);
    }

    // Add empty line to separate headers from body
    emailLines.push("");

    // Add the email body
    emailLines.push(body);

    // Join lines and encode as base64
    const email = emailLines.join("\r\n");
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send the email
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
        threadId: threadId,
      },
    });

    console.log("Email reply sent successfully:", response.data);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error("Error sending email reply:", error);
    return {
      success: false,
      error: error.message || "Failed to send email reply",
    };
  }
}

module.exports = {
  handleSendEmailReply,
};
