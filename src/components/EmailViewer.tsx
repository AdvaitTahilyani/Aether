import { useState, useEffect, useRef, RefObject, useCallback } from "react";
import { EmailDetails } from "../types";
import {
  getEmailSubject,
  getEmailSender,
  formatDetailedDate,
  getEnhancedEmailBody,
  checkEmailAPIAvailable,
  getEmailRecipients,
  getEmailCcRecipients,
  parseEmailAddress,
  getEmailLabels,
  decodeBase64,
} from "../services";
import EmailSummarizer from "./EmailSummarizer";
import EmailThreadList from "./viewer-components/EmailThreadList";
import ComposeEmail from "./ComposeEmail";
import AutoReplyGenerator from "./AutoReplyGenerator";

interface EmailViewerProps {
  selectedEmail: EmailDetails | null;
  userEmail?: string;
  onClearSelection?: () => void;
}

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
        return body;
      }

      // If body has html content, use that
      if (body.html) {
        return body.html;
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
      // Check for HTML part first
      const htmlPart = email.payload.parts?.find(
        (part) => part.mimeType === "text/html"
      );
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        return decodeBase64(htmlPart.body.data);
      }

      // Then check for plain text part
      const textPart = email.payload.parts?.find(
        (part) => part.mimeType === "text/plain"
      );
      if (textPart && textPart.body && textPart.body.data) {
        const plainText = decodeBase64(textPart.body.data);
        return `<div style="font-family: sans-serif; line-height: 1.6;">${plainText.replace(
          /\n/g,
          "<br>"
        )}</div>`;
      }

      // If no parts, check for body directly in the payload
      if (email.payload.body && email.payload.body.data) {
        const content = decodeBase64(email.payload.body.data);
        if (email.payload.mimeType === "text/html") {
          return content;
        } else {
          return `<div style="font-family: sans-serif; line-height: 1.6;">${content.replace(
            /\n/g,
            "<br>"
          )}</div>`;
        }
      }
    }

    // If all else fails, use getEnhancedEmailBody as a fallback
    return getEnhancedEmailBody(email);
  } catch (error) {
    console.error("Error getting email body:", error);
    // If there's an error, return the snippet wrapped in a paragraph
    return email?.snippet
      ? `<p>${email.snippet}</p>`
      : "<p>Unable to display email content</p>";
  }
};

function EmailViewer({ selectedEmail, userEmail = "user@example.com", onClearSelection }: EmailViewerProps) {
  const [threadEmails, setThreadEmails] = useState<EmailDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecipients, setExpandedRecipients] = useState<Set<string>>(
    new Set()
  );
  // Track emails that have been marked as read during this session
  const [markedAsRead, setMarkedAsRead] = useState<Set<string>>(new Set());
  // Add state for tracking which email is being replied to
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState<boolean>(false);
  // Ref to store timers for marking emails as read
  const readTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  // Add a ref for the iframe with the correct type
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // State to control whether the summarizer is expanded
  const [isSummarizerExpanded, setIsSummarizerExpanded] = useState<boolean>(false);
  // State to store generated replies
  const [generatedReplies, setGeneratedReplies] = useState<Record<string, string>>({});

  // Toggle recipient expansion for a specific email
  const toggleRecipients = (emailId: string) => {
    setExpandedRecipients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  // Function to mark an email as read
  const markEmailAsRead = async (emailId: string) => {
    if (
      !checkEmailAPIAvailable() ||
      !window.electronAPI?.markEmailAsRead ||
      markedAsRead.has(emailId)
    ) {
      return;
    }

    try {
      const result = await window.electronAPI.markEmailAsRead(emailId);
      if (result.success) {
        console.log(`Email ${emailId} marked as read`);
        // Add to our local set of marked emails
        setMarkedAsRead((prev) => new Set([...prev, emailId]));

        // Update the thread emails to reflect the change
        setThreadEmails((prev) =>
          prev.map((email) => {
            if (email.id === emailId) {
              // Create a new email object with updated labels
              return {
                ...email,
                labelIds: (email.labelIds || []).filter(
                  (label) => label !== "UNREAD"
                ),
              };
            }
            return email;
          })
        );
      }
    } catch (error) {
      console.error("Failed to mark email as read:", error);
    }
  };

  // Set up timers to mark emails as read after 5 seconds of viewing
  useEffect(() => {
    // Clear any existing timers when emails change
    Object.values(readTimersRef.current).forEach((timer) =>
      clearTimeout(timer)
    );
    readTimersRef.current = {};

    if (!threadEmails.length) return;

    // For each unread email in the thread, set up a timer
    threadEmails.forEach((email) => {
      if (
        email.id &&
        email.labelIds &&
        email.labelIds.includes("UNREAD") &&
        !markedAsRead.has(email.id)
      ) {
        // Set a 5-second timer to mark the email as read
        readTimersRef.current[email.id] = setTimeout(() => {
          markEmailAsRead(email.id!);
        }, 5000); // 5 seconds
      }
    });

    // Cleanup function to clear timers
    return () => {
      Object.values(readTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      readTimersRef.current = {};
    };
  }, [threadEmails, markedAsRead]);

  // Fetch thread emails when selected email changes
  useEffect(() => {
    if (!selectedEmail) {
      setThreadEmails([]);
      return;
    }

    // Start with the selected email
    setThreadEmails([selectedEmail]);

    // If we have a threadId, fetch other emails in the thread
    if (
      selectedEmail.threadId &&
      checkEmailAPIAvailable() &&
      typeof window.electronAPI?.getThreadEmails === "function"
    ) {
      const fetchThreadEmails = async () => {
        try {
          setLoading(true);
          // Fetch up to 25 emails in the thread
          const threadMessages = await window.electronAPI!.getThreadEmails(
            selectedEmail.threadId,
            25 // Request at least 25 emails
          );

          if (!threadMessages || threadMessages.length === 0) {
            // If no thread messages, just use the selected email
            setThreadEmails([selectedEmail]);
            return;
          }

          // Sort emails by date (newest first)
          const sortedEmails = threadMessages.sort(
            (a, b) =>
              parseInt(b.internalDate || "0") - parseInt(a.internalDate || "0")
          );

          setThreadEmails(sortedEmails);
        } catch (err) {
          console.error("Error fetching thread emails:", err);
          setError("Failed to load the complete conversation");
          // Still show the selected email
          setThreadEmails([selectedEmail]);
        } finally {
          setLoading(false);
        }
      };

      fetchThreadEmails();
    }
  }, [selectedEmail]);

  // Handle auto-reply generation when a new email is selected
  const handleReplyGenerated = (emailId: string, reply: string) => {
    setGeneratedReplies(prev => ({
      ...prev,
      [emailId]: reply
    }));
  };

  // Function to render HTML content in iframe
  const renderEmailInIframe = (
    htmlContent: string,
    iframeElement: HTMLIFrameElement | null
  ) => {
    if (!iframeElement) return;

    const iframeDoc =
      iframeElement.contentDocument || iframeElement.contentWindow?.document;
    if (!iframeDoc) return;

    // Create a complete HTML document with proper doctype and meta tags
    const completeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            a {
              color: #2563eb;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            pre, code {
              background-color: #f1f5f9;
              border-radius: 4px;
              padding: 2px 4px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 0.9em;
            }
            pre {
              padding: 1em;
              overflow-x: auto;
            }
            blockquote {
              border-left: 4px solid #e2e8f0;
              margin-left: 0;
              padding-left: 1em;
              color: #64748b;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            table, th, td {
              border: 1px solid #e2e8f0;
            }
            th, td {
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Write the HTML to the iframe
    iframeDoc.open();
    iframeDoc.write(completeHtml);
    iframeDoc.close();

    // Make links open in a new tab
    const links = iframeDoc.getElementsByTagName("a");
    for (let i = 0; i < links.length; i++) {
      links[i].setAttribute("target", "_blank");
      links[i].setAttribute("rel", "noopener noreferrer");
    }
  };

  // Effect to render email in iframe when content changes
  useEffect(() => {
    if (threadEmails.length > 0) {
      // Add a small delay to ensure DOM has updated
      setTimeout(() => {
        threadEmails.forEach((email, index) => {
          const iframe = document.getElementById(
            `email-iframe-${email.id || index}`
          ) as HTMLIFrameElement;
          if (iframe) {
            const emailBody = safeGetEmailBody(email);
            renderEmailInIframe(emailBody, iframe);
          }
        });
      }, 100);
    }
  }, [threadEmails]);

  // Handle reply success
  const handleReplySuccess = () => {
    // Reset reply-related state
    setReplyingToId(null);
    setShowReplyForm(false);
    
    // Clear the selected email to show the default screen
    if (onClearSelection) {
      onClearSelection();
    } else {
      // If no callback is provided, just clear local state
      setThreadEmails([]);
      setLoading(false);
      setError(null);
    }
  };

  // Handle reply button click
  const handleReply = () => {
    // If we have thread emails, reply to the most recent one
    if (threadEmails.length > 0 && threadEmails[0].id) {
      setReplyingToId(threadEmails[0].id);
      setShowReplyForm(true);
    } else if (selectedEmail && selectedEmail.id) {
      // Otherwise reply to the selected email
      setReplyingToId(selectedEmail.id);
      setShowReplyForm(true);
    }
  };

  // Handle cancel reply
  const handleCancelReply = () => {
    setReplyingToId(null);
    setShowReplyForm(false);
  };

  // Handle forwarding an email
  const handleForward = (email: EmailDetails) => {
    if (email && email.id) {
      setShowReplyForm(true);
      // We're not setting replyingToId here because it's not a reply
    }
  };

  // Handle email deletion success
  const handleDeleteSuccess = () => {
    // Clear the selected email to show the default screen
    if (onClearSelection) {
      onClearSelection();
    } else {
      // If no callback is provided, just clear local state
      setThreadEmails([]);
      setLoading(false);
      setError(null);
    }
  };

  if (!selectedEmail) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-white text-gray-500">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto mb-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-medium mb-2">No Email Selected</h3>
          <p>Select an email from the list to view its contents</p>
        </div>
      </div>
    );
  }

  // Get the subject from the most recent email in the thread
  const subject =
    threadEmails.length > 0
      ? getEmailSubject(threadEmails[0])
      : getEmailSubject(selectedEmail);

  // Get unique participants from all emails in the thread
  const getUniqueParticipants = () => {
    const participants = new Set<string>();

    threadEmails.forEach((email) => {
      // Add sender
      const sender = getEmailSender(email);
      const { name: senderName } = parseEmailAddress(sender);
      if (senderName) {
        participants.add(senderName);
      }

      // Add recipients
      getEmailRecipients(email).forEach((recipient) => {
        const { name: recipientName } = parseEmailAddress(recipient);
        if (recipientName) {
          participants.add(recipientName);
        }
      });

      // Add CC recipients
      getEmailCcRecipients(email).forEach((recipient) => {
        const { name: recipientName } = parseEmailAddress(recipient);
        if (recipientName) {
          participants.add(recipientName);
        }
      });
    });

    return Array.from(participants);
  };

  const uniqueParticipants = getUniqueParticipants();

  // Background auto-reply generator for the most recent email in the thread
  // Memoize this function to prevent unnecessary re-renders
  const backgroundAutoReplyGenerator = useCallback(() => {
    const mostRecentEmail = threadEmails.length > 0 ? threadEmails[0] : selectedEmail;
    
    // Only generate a reply for the most recent email in the thread
    if (mostRecentEmail && mostRecentEmail.id && !generatedReplies[mostRecentEmail.id]) {
      return (
        <AutoReplyGenerator
          key={mostRecentEmail.id} // Add key prop to ensure proper re-rendering
          email={mostRecentEmail}
          onReplyGenerated={(reply) => handleReplyGenerated(mostRecentEmail.id!, reply)}
          userEmail={userEmail}
        />
      );
    }
    
    return null;
  }, [threadEmails, selectedEmail, generatedReplies, userEmail]);

  // Effect to render email in iframe when thread emails change
  useEffect(() => {
    if (threadEmails.length > 0) {
      setTimeout(() => {
        threadEmails.forEach((email, index) => {
          const iframe = document.getElementById(
            `email-iframe-${email.id || index}`
          ) as HTMLIFrameElement;
          
          if (iframe) {
            const emailBody = safeGetEmailBody(email);
            renderEmailInIframe(emailBody, iframe);
          }
        });
      }, 100);
    }
  }, [threadEmails]);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Background auto-reply generator */}
      {backgroundAutoReplyGenerator()}
      
      {/* Header with the most recent subject and reply button - removed sticky positioning */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex justify-between items-center px-4 py-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-black tracking-tight truncate">
              {subject}
            </h2>
            
            {/* Display email labels in a more compact way */}
            {threadEmails.length > 0 && getEmailLabels(threadEmails[0]).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {getEmailLabels(threadEmails[0]).map((label, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                      border: `1px solid ${label.color}`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reply button - updated with modern design */}
          <div className="ml-2 flex-shrink-0">
            <button
              onClick={handleReply}
              className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={replyingToId !== null}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              Reply
            </button>
          </div>
        </div>

        {/* Collapsible Email summary - updated with better styling */}
        <div className="px-4 pb-2">
          <button 
            onClick={() => setIsSummarizerExpanded(!isSummarizerExpanded)}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 mr-1 transition-transform ${
                isSummarizerExpanded ? "rotate-90" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            AI Summary
          </button>
          {isSummarizerExpanded && (
            <div className="mt-2 p-3 bg-indigo-50 rounded-lg">
              <EmailSummarizer email={selectedEmail} />
            </div>
          )}
        </div>
      </div>

      {/* Email thread content with proper scrolling - takes up all remaining space */}
      <div className="flex-1 overflow-auto">
        <EmailThreadList
          key={threadEmails.map(email => email.id).join('-')}
          threadEmails={threadEmails}
          expandedRecipients={expandedRecipients}
          toggleRecipients={toggleRecipients}
          iframeRef={iframeRef as RefObject<HTMLIFrameElement>}
          loading={loading}
          error={error}
          onReplySuccess={handleReplySuccess}
          onDeleteSuccess={handleDeleteSuccess}
          replyingToId={replyingToId}
          setReplyingToId={setReplyingToId}
          onReply={handleReply}
          onForward={handleForward}
        />
      </div>

      {/* Reply/Forward Form Modal */}
      {showReplyForm && (
        <ComposeEmail
          userEmail={userEmail}
          onClose={handleCancelReply}
          onSent={handleReplySuccess}
          isReply={replyingToId !== null}
          isForward={replyingToId === null && showReplyForm}
          replyToEmail={replyingToId 
            ? threadEmails.find(email => email.id === replyingToId) || selectedEmail 
            : threadEmails[0] || selectedEmail}
          replyToSubject={replyingToId 
            ? getEmailSubject(threadEmails.find(email => email.id === replyingToId) || selectedEmail)
            : getEmailSubject(threadEmails[0] || selectedEmail)}
          replyToAddress={replyingToId 
            ? parseEmailAddress(getEmailSender(threadEmails.find(email => email.id === replyingToId) || selectedEmail)).email
            : parseEmailAddress(getEmailSender(threadEmails[0] || selectedEmail)).email}
        />
      )}
    </div>
  );
}

export default EmailViewer;
