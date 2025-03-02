import { EmailDetails, EmailHeader, BasicEmail } from "../types/email";

// Helper function to create a fallback email when details aren't available
export const createFallbackEmail = (email: BasicEmail | any): EmailDetails => {
  // Initialize headers array
  const headers: Array<{ name: string; value: string }> = [];

  // Check if the email already has direct properties and add them to headers
  if (email.subject) {
    headers.push({ name: "Subject", value: email.subject });
  }

  if (email.from) {
    headers.push({ name: "From", value: email.from });
  }

  // Handle 'to' which could be a string or array
  if (email.to) {
    const toValue = Array.isArray(email.to) ? email.to.join(", ") : email.to;
    headers.push({ name: "To", value: toValue });
  }

  // Handle 'cc' which could be a string or array
  if (email.cc) {
    const ccValue = Array.isArray(email.cc) ? email.cc.join(", ") : email.cc;
    headers.push({ name: "Cc", value: ccValue });
  }

  // Handle date if available
  if (email.date) {
    const dateValue =
      typeof email.date === "object" ? email.date.toString() : email.date;
    headers.push({ name: "Date", value: dateValue });
  }

  // Create a basic payload structure
  const payload: any = {
    headers,
    mimeType: email.mimeType || "text/html",
  };

  // Handle body content if available
  if (email.body) {
    if (typeof email.body === "string") {
      // If body is a string, create a simple body object
      payload.body = { data: btoa(unescape(encodeURIComponent(email.body))) };
    } else if (typeof email.body === "object") {
      // If body is an object with html/plain properties
      payload.body = { data: "" };

      // Create parts for multipart emails
      payload.parts = [];

      if (email.body.html) {
        payload.parts.push({
          mimeType: "text/html",
          body: { data: btoa(unescape(encodeURIComponent(email.body.html))) },
        });
      }

      if (email.body.plain) {
        payload.parts.push({
          mimeType: "text/plain",
          body: { data: btoa(unescape(encodeURIComponent(email.body.plain))) },
        });
      }
    }
  }

  // Create the fallback email object
  return {
    id: email.id || `fallback-${Date.now()}`,
    threadId: email.threadId || email.id || `thread-${Date.now()}`,
    labelIds: email.labelIds || [],
    snippet:
      email.snippet ||
      (typeof email.body === "string" ? email.body.substring(0, 100) : ""),
    internalDate:
      email.internalDate || email.date?.toString() || Date.now().toString(),
    payload,
    sizeEstimate: email.sizeEstimate || 0,
    historyId: email.historyId || "",
  };
};

// Helper function to decode base64 content with improved error handling
export const decodeBase64 = (data: string): string => {
  if (!data) {
    return "";
  }

  try {
    // Remove any whitespace that might be in the base64 string
    const cleanData = data.replace(/\s/g, "");

    // Handle URL-safe base64 (replace - with + and _ with /)
    const urlSafeData = cleanData.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    let paddedData = urlSafeData;
    const padding = urlSafeData.length % 4;
    if (padding > 0) {
      paddedData += "=".repeat(4 - padding);
    }

    // Decode the base64 string using browser-compatible methods
    try {
      // First try with atob and decodeURIComponent
      const binary = atob(paddedData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
      // If that fails, try a simpler approach
      try {
        return decodeURIComponent(escape(atob(paddedData)));
      } catch (e2) {
        // Last resort, just use atob
        return atob(paddedData);
      }
    }
  } catch (error) {
    console.error("Error decoding base64 content:", error);
    return "Error decoding email content";
  }
};

// Helper function to enhance and sanitize email body content
export const enhanceEmailBody = (htmlContent: string): string => {
  if (!htmlContent) {
    return "";
  }

  return sanitizeHtml(htmlContent);
};

// Helper function to extract email body content with enhanced handling
export const getEnhancedEmailBody = (email: EmailDetails | null): string => {
  if (!email) {
    return "No content available";
  }

  try {
    // Check if the email has a direct body property (from our JSON)
    if ((email as any).body) {
      const body = (email as any).body;

      // If body is a string, return it directly
      if (typeof body === "string") {
        return sanitizeHtml(body);
      }

      // If body has html content, use that
      if (body.html) {
        return sanitizeHtml(body.html);
      }

      // Otherwise use plain text
      if (body.plain) {
        return convertPlainTextToHtml(body.plain);
      }
    }

    // If no direct body, try to extract from payload
    // Check if payload exists
    if (!email.payload) {
      return email.snippet || "No content available";
    }

    // Enhanced function to recursively search for content in parts
    const extractContentFromParts = (
      part: any,
      contentParts: { html: string[]; plain: string[]; attachments: any[] } = {
        html: [],
        plain: [],
        attachments: [],
      },
      depth = 0
    ): { html: string[]; plain: string[]; attachments: any[] } => {
      // Prevent infinite recursion
      if (depth > 20) {
        console.warn(
          "Reached maximum recursion depth while parsing email parts"
        );
        return contentParts;
      }

      if (!part) return contentParts;

      // Check if this part is an attachment
      if (part.filename && part.body && part.body.attachmentId) {
        contentParts.attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
          partId: part.partId || "",
        });
      }

      // Extract content from this part if it has data
      if (part.body && part.body.data) {
        const decodedContent = decodeBase64(part.body.data);

        if (part.mimeType === "text/html") {
          contentParts.html.push(decodedContent);
        } else if (part.mimeType === "text/plain") {
          contentParts.plain.push(decodedContent);
        } else if (part.mimeType && part.mimeType.startsWith("multipart/")) {
          // For multipart content without explicit parts, try to parse it
          if (decodedContent && decodedContent.trim()) {
            // Check if it contains HTML tags
            if (/<[a-z][\s\S]*>/i.test(decodedContent)) {
              contentParts.html.push(decodedContent);
            } else {
              contentParts.plain.push(decodedContent);
            }
          }
        }
      }

      // Process nested parts recursively
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach((subpart: any) => {
          extractContentFromParts(subpart, contentParts, depth + 1);
        });
      }

      return contentParts;
    };

    // Extract all content parts from the email
    const allContent = extractContentFromParts(email.payload);

    // Create a container for the email content
    let emailContent = '<div class="email-content">';

    // Add attachments information if available
    if (allContent.attachments.length > 0) {
      emailContent += '<div class="email-attachments">';
      allContent.attachments.forEach((attachment) => {
        emailContent += `
          <div class="email-attachment">
            <span class="attachment-icon">📎</span>
            <span class="attachment-name">${attachment.filename}</span>
            <span class="attachment-size">(${formatFileSize(
              attachment.size
            )})</span>
            <span class="attachment-data" 
                  data-attachment-id="${attachment.attachmentId}" 
                  data-mime-type="${attachment.mimeType}"
                  data-filename="${attachment.filename}"
                  data-part-id="${attachment.partId}"></span>
          </div>
        `;
      });
      emailContent += "</div>";
    }

    // Prioritize HTML content if available
    if (allContent.html.length > 0) {
      // Join all HTML parts with separators
      emailContent += sanitizeHtml(
        allContent.html.join('<hr class="email-part-separator" />')
      );
    }
    // Fall back to plain text content
    else if (allContent.plain.length > 0) {
      // Convert plain text to HTML with proper formatting
      emailContent += convertPlainTextToHtml(allContent.plain.join("\n\n"));
    }
    // If no parts with content were found, try the main body
    else if (email.payload.body && email.payload.body.data) {
      const content = decodeBase64(email.payload.body.data);

      if (email.payload.mimeType === "text/html") {
        emailContent += sanitizeHtml(content);
      } else if (email.payload.mimeType === "text/plain") {
        emailContent += convertPlainTextToHtml(content);
      } else {
        // For other mime types, try to detect if it's HTML
        if (/<[a-z][\s\S]*>/i.test(content)) {
          emailContent += sanitizeHtml(content);
        } else {
          emailContent += convertPlainTextToHtml(content);
        }
      }
    }
    // If all else fails, return the snippet
    else {
      emailContent += `<p class="email-snippet">${
        email.snippet || "No content available"
      }</p>`;
    }

    // Close the container
    emailContent += "</div>";

    return emailContent;
  } catch (error) {
    console.error("Error extracting email body:", error);
    return `<div class="email-error">${
      email?.snippet || "Error displaying email content"
    }</div>`;
  }
};

// Helper function to convert plain text to HTML
export const convertPlainTextToHtml = (text: string): string => {
  if (!text) return "";

  // Escape HTML special characters
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Convert line breaks to <br> tags
  const withLineBreaks = escaped.replace(/\n/g, "<br />");

  // Convert URLs to clickable links
  const withLinks = withLineBreaks.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Convert email addresses to mailto links
  const withMailto = withLinks.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1">$1</a>'
  );

  // Preserve multiple spaces
  const withSpaces = withMailto.replace(/\s{2,}/g, (match) =>
    "&nbsp;".repeat(match.length)
  );

  return `<div class="email-plain-text">${withSpaces}</div>`;
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to get email subject with improved error handling
export const getEmailSubject = (email: EmailDetails | null): string => {
  if (!email) {
    return "No Subject";
  }

  try {
    // Check if the email has a direct subject property
    if ((email as any).subject) {
      return (email as any).subject;
    }

    // Check if the email has a payload with headers
    if (!email.payload || !email.payload.headers) {
      // If no payload or headers, return the snippet or a default message
      return email.snippet || "No Subject";
    }

    // Find the subject header
    const subjectHeader = email.payload.headers.find(
      (header) => header.name.toLowerCase() === "subject"
    );

    if (subjectHeader && subjectHeader.value) {
      return subjectHeader.value;
    }

    // If no subject header found, return the snippet or a default message
    return email.snippet || "No Subject";
  } catch (error) {
    console.error("Error getting email subject:", error);
    return "No Subject";
  }
};

// Helper function to get email sender with improved error handling
export const getEmailSender = (email: EmailDetails | null): string => {
  if (!email) {
    console.warn("getEmailSender called with null email");
    return "Unknown Sender";
  }

  try {
    // Check if the email has a direct from property
    if ((email as any).from) {
      console.log("Found direct from property:", (email as any).from);
      return (email as any).from;
    }

    // Check if the email has a payload with headers
    if (!email.payload || !email.payload.headers) {
      console.warn("Email missing payload or headers:", email.id);
      return "Unknown Sender";
    }

    // Find the from header
    const fromHeader = email.payload.headers.find(
      (header) => header.name.toLowerCase() === "from"
    );

    if (fromHeader && fromHeader.value) {
      console.log("Found from header:", fromHeader.value);
      return fromHeader.value;
    }

    console.warn("No from header found in email:", email.id);
    return "Unknown Sender";
  } catch (error) {
    console.error("Error getting email sender:", error);
    return "Unknown Sender";
  }
};

// Helper function to format date from timestamp
export const formatDate = (timestamp: string | undefined): string => {
  if (!timestamp) {
    return new Date().toLocaleDateString();
  }

  try {
    const date = new Date(parseInt(timestamp));

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn("Invalid timestamp:", timestamp);
      return new Date().toLocaleDateString();
    }

    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return new Date().toLocaleDateString();
  }
};

// Helper function to extract email recipients (To field)
export const getEmailRecipients = (email: EmailDetails | null): string[] => {
  if (!email || !email.payload) {
    return [];
  }

  try {
    // Check if headers array exists
    if (!Array.isArray(email.payload.headers)) {
      return [];
    }

    const toHeader = email.payload.headers.find(
      (header: EmailHeader) => header.name.toLowerCase() === "to"
    );

    if (!toHeader || !toHeader.value) {
      return [];
    }
    console.log(`To: ${toHeader.value}`);
    // Split by commas and trim whitespace
    return parseRecipients(toHeader.value);
  } catch (error) {
    console.error("Error extracting email recipients:", error);
    return [];
  }
};

// Helper function to extract CC recipients
export const getEmailCcRecipients = (email: EmailDetails | null): string[] => {
  if (!email || !email.payload) {
    return [];
  }

  try {
    // Check if headers array exists
    if (!Array.isArray(email.payload.headers)) {
      return [];
    }

    const ccHeader = email.payload.headers.find(
      (header: EmailHeader) => header.name.toLowerCase() === "cc"
    );

    if (!ccHeader || !ccHeader.value) {
      return [];
    }

    // Split by commas and trim whitespace
    return parseRecipients(ccHeader.value);
  } catch (error) {
    console.error("Error extracting CC recipients:", error);
    return [];
  }
};

// Helper function to extract BCC recipients
export const getEmailBccRecipients = (email: EmailDetails | null): string[] => {
  if (!email || !email.payload) {
    return [];
  }

  try {
    // Check if headers array exists
    if (!Array.isArray(email.payload.headers)) {
      return [];
    }

    const bccHeader = email.payload.headers.find(
      (header: EmailHeader) => header.name.toLowerCase() === "bcc"
    );

    if (!bccHeader || !bccHeader.value) {
      return [];
    }

    // Split by commas and trim whitespace
    return parseRecipients(bccHeader.value);
  } catch (error) {
    console.error("Error extracting BCC recipients:", error);
    return [];
  }
};

// Helper function to parse recipients with proper handling of quoted addresses
export const parseRecipients = (headerValue: string): string[] => {
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
    console.error(`Error parsing recipients from "${headerValue}":`, error);
    return [];
  }
};

// Helper function to extract name and email from a formatted email string
// Example: "John Doe <john@example.com>" -> { name: "John Doe", email: "john@example.com" }
export const parseEmailAddress = (
  emailString: string
): { name: string; email: string } => {
  try {
    if (!emailString) {
      return { name: "", email: "" };
    }

    // Check for the standard format: "Name <email@example.com>"
    const standardFormatMatch = emailString.match(/^(.*?)\s*<([^>]+)>$/);
    if (standardFormatMatch) {
      const [, name, email] = standardFormatMatch;
      return {
        name: name?.trim() || email,
        email: email.trim(),
      };
    }

    // Check for email-only format (no name)
    const emailOnlyMatch = emailString.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (emailOnlyMatch) {
      const [, email] = emailOnlyMatch;
      return {
        name: email,
        email: email,
      };
    }

    // If no clear email format is found, try to extract anything that looks like an email
    const emailExtract = emailString.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
    if (emailExtract) {
      const [, email] = emailExtract;
      // Use everything before the email as the name, or the email itself if no name is found
      const nameMatch = emailString.replace(email, "").trim();
      return {
        name: nameMatch || email,
        email: email,
      };
    }

    // Fallback: just return the string as both name and email
    console.warn(`Could not parse email address: ${emailString}`);
    return {
      name: emailString,
      email: emailString,
    };
  } catch (error) {
    console.error("Error parsing email address:", error);
    return {
      name: emailString,
      email: emailString,
    };
  }
};

// Helper function to get a more detailed date format
export const formatDetailedDate = (timestamp: string | undefined): string => {
  if (!timestamp) {
    return new Date().toLocaleString();
  }

  try {
    const date = new Date(parseInt(timestamp));

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn("Invalid timestamp for detailed date:", timestamp);
      return new Date().toLocaleString();
    }

    return date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting detailed date:", error);
    return new Date().toLocaleString();
  }
};

// Helper function to get important labels from an email
export const getEmailLabels = (
  email: EmailDetails | null
): { name: string; color: string }[] => {
  if (!email) {
    return [];
  }

  try {
    // Check if labelIds array exists
    if (!Array.isArray(email.labelIds)) {
      return [];
    }

    const labelMap: Record<string, { name: string; color: string }> = {
      IMPORTANT: { name: "Important", color: "#d93025" },
      STARRED: { name: "Starred", color: "#f4b400" },
      UNREAD: { name: "Unread", color: "#1a73e8" },
      INBOX: { name: "Inbox", color: "#188038" },
      SENT: { name: "Sent", color: "#1a73e8" },
      DRAFT: { name: "Draft", color: "#a142f4" },
      SPAM: { name: "Spam", color: "#d93025" },
      TRASH: { name: "Trash", color: "#5f6368" },
      CATEGORY_PERSONAL: { name: "Personal", color: "#1a73e8" },
      CATEGORY_SOCIAL: { name: "Social", color: "#1e8e3e" },
      CATEGORY_PROMOTIONS: { name: "Promotions", color: "#fbbc04" },
      CATEGORY_UPDATES: { name: "Updates", color: "#a142f4" },
      CATEGORY_FORUMS: { name: "Forums", color: "#f5b400" },
    };

    // Filter to only include important labels and map to display format
    return email.labelIds
      .filter((labelId) => labelMap[labelId])
      .map((labelId) => labelMap[labelId]);
  } catch (error) {
    console.error("Error extracting email labels:", error);
    return [];
  }
};

// Function to delete an email using the Gmail API
export const deleteEmail = async (emailId: string): Promise<boolean> => {
  try {
    if (!checkEmailAPIAvailable()) {
      console.error("Electron API is not available");
      return false;
    }

    // We've already checked that electronAPI exists
    await window.electronAPI!.deleteEmail(emailId);
    return true;
  } catch (error) {
    console.error("Error deleting email:", error);
    // Rethrow the error with the original message to preserve error details
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to delete email: ${String(error)}`);
    }
  }
};

// Helper function to check if Electron API is available
export const checkEmailAPIAvailable = (): boolean => {
  return typeof window !== "undefined" && !!window.electronAPI;
};

// Helper function to check if an email has valid headers
export const hasValidHeaders = (email: EmailDetails | null): boolean => {
  if (!email) {
    return false;
  }

  // Check if the email has direct properties (subject, from, to)
  if ((email as any).subject && (email as any).from) {
    return true;
  }

  // Check if the email has a payload with headers
  if (
    email.payload &&
    Array.isArray(email.payload.headers) &&
    email.payload.headers.length > 0
  ) {
    // Check if essential headers exist
    const hasSubject = email.payload.headers.some(
      (header) => header.name.toLowerCase() === "subject"
    );

    const hasFrom = email.payload.headers.some(
      (header) => header.name.toLowerCase() === "from"
    );

    return hasSubject && hasFrom;
  }

  return false;
};

// Helper function to sanitize HTML content
export const sanitizeHtml = (html: string): string => {
  if (!html) {
    return "";
  }

  try {
    // Basic sanitization - remove script tags and on* attributes
    let sanitized = html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove on* event handlers (onclick, onload, etc.)
      .replace(/\son\w+\s*=\s*["']?[^"']*["']?/gi, "")
      // Remove javascript: URLs
      .replace(/href\s*=\s*["']?javascript:[^"']*["']?/gi, 'href="#"')
      // Remove data: URLs which could contain scripts
      .replace(/href\s*=\s*["']?data:[^"']*["']?/gi, 'href="#"')
      // Remove iframe tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      // Remove base tags that could change relative URLs
      .replace(/<base\b[^<]*(?:(?!<\/base>)<[^<]*)*<\/base>/gi, "")
      // Remove meta refresh tags
      .replace(/<meta\s+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
      // Remove object tags (potential Flash or other embedded content)
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      // Remove embed tags
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
      // Remove applet tags
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "")
      // Remove all noscript tags
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
      // Remove all form tags
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      // Remove all svg tags which could contain scripts
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");

    // Remove all event handlers (more comprehensive than just on*)
    const eventHandlers = [
      "onabort",
      "onafterprint",
      "onanimationend",
      "onanimationiteration",
      "onanimationstart",
      "onbeforeprint",
      "onbeforeunload",
      "onblur",
      "oncanplay",
      "oncanplaythrough",
      "onchange",
      "onclick",
      "oncontextmenu",
      "oncopy",
      "oncut",
      "ondblclick",
      "ondrag",
      "ondragend",
      "ondragenter",
      "ondragleave",
      "ondragover",
      "ondragstart",
      "ondrop",
      "ondurationchange",
      "onended",
      "onerror",
      "onfocus",
      "onfocusin",
      "onfocusout",
      "onfullscreenchange",
      "onfullscreenerror",
      "ongotpointercapture",
      "onhashchange",
      "oninput",
      "oninvalid",
      "onkeydown",
      "onkeypress",
      "onkeyup",
      "onload",
      "onloadeddata",
      "onloadedmetadata",
      "onloadstart",
      "onlostpointercapture",
      "onmessage",
      "onmousedown",
      "onmouseenter",
      "onmouseleave",
      "onmousemove",
      "onmouseout",
      "onmouseover",
      "onmouseup",
      "onmousewheel",
      "onoffline",
      "ononline",
      "onpagehide",
      "onpageshow",
      "onpaste",
      "onpause",
      "onplay",
      "onplaying",
      "onpointercancel",
      "onpointerdown",
      "onpointerenter",
      "onpointerleave",
      "onpointermove",
      "onpointerout",
      "onpointerover",
      "onpointerup",
      "onpopstate",
      "onprogress",
      "onratechange",
      "onreset",
      "onresize",
      "onscroll",
      "onsearch",
      "onseeked",
      "onseeking",
      "onselect",
      "onselectionchange",
      "onselectstart",
      "onshow",
      "onstalled",
      "onstorage",
      "onsubmit",
      "onsuspend",
      "ontimeupdate",
      "ontoggle",
      "ontouchcancel",
      "ontouchend",
      "ontouchmove",
      "ontouchstart",
      "ontransitionend",
      "onunload",
      "onvolumechange",
      "onwaiting",
      "onwheel",
    ];

    eventHandlers.forEach((handler) => {
      const regex = new RegExp(`\\s${handler}\\s*=\\s*["'][^"']*["']`, "gi");
      sanitized = sanitized.replace(regex, "");
    });

    // Fix unclosed tags
    const unclosedTags = ["img", "br", "hr", "input", "meta", "link"];
    unclosedTags.forEach((tag) => {
      const regex = new RegExp(`<${tag}([^>]*)(?<!/)>`, "gi");
      sanitized = sanitized.replace(regex, `<${tag}$1 />`);
    });

    // Fix image URLs - ensure they use https if they're using http
    sanitized = sanitized.replace(
      /src=["']http:\/\/([^"']+)["']/gi,
      'src="https://$1"'
    );

    // Handle cid: image references that might be in the email
    sanitized = sanitized.replace(
      /src=["']cid:([^"']+)["']/gi,
      'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" data-cid="$1"'
    );

    // Add target="_blank" to all links to open in new tab
    sanitized = sanitized.replace(/<a\s+(?![^>]*\btarget=)[^>]*>/gi, (match) =>
      match.replace(/>$/, ' target="_blank" rel="noopener noreferrer">')
    );

    // Add classes to blockquotes for styling quoted content
    sanitized = sanitized.replace(
      /<blockquote[^>]*>/gi,
      '<blockquote class="email-quote">'
    );

    // Handle Gmail-specific quote classes
    sanitized = sanitized.replace(
      /<div class=["']gmail_quote["'][^>]*>/gi,
      '<div class="email-quote gmail-quote">'
    );

    // Ensure the content has proper HTML structure
    if (!sanitized.includes("<html") && !sanitized.includes("<body")) {
      sanitized = `<div class="email-body-content">${sanitized}</div>`;
    }

    return sanitized;
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return html; // Return original if sanitization fails
  }
};

// Helper function to extract all unique participants from a thread
export const getThreadParticipants = (emails: EmailDetails[]): string[] => {
  if (!emails || !emails.length) {
    return [];
  }

  try {
    const participants = new Set<string>();

    emails.forEach((email) => {
      // Add sender
      const from = getEmailSender(email);
      if (from && from !== "Unknown Sender") {
        participants.add(from);
      }

      // Add recipients
      const to = getEmailRecipients(email);
      to.forEach((recipient) => participants.add(recipient));

      // Add CC recipients
      const cc = getEmailCcRecipients(email);
      cc.forEach((recipient) => participants.add(recipient));

      // Add BCC recipients (if available)
      const bcc = getEmailBccRecipients(email);
      bcc.forEach((recipient) => participants.add(recipient));
    });

    return Array.from(participants);
  } catch (error) {
    console.error("Error extracting thread participants:", error);
    return [];
  }
};

// Interface for email data
export interface EmailData {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}

// Function to send an email
export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Sending email:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
      });
    }
    
    // In a real implementation, this would call the API or Electron bridge
    // For now, we'll just simulate a successful send
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};
