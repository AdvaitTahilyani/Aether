import React, { useState, useEffect } from "react";
import { EmailDetails } from "../../types";
import {
  getEmailSubject,
  getEmailSender,
  getEmailRecipients,
  getEmailCcRecipients,
  parseEmailAddress,
  getEmailLabels,
} from "../../services";
import EmailSummarizer from "../EmailSummarizer";
import { safeGetEmailBody } from "./SafeEmailBody";

interface EmailHeaderProps {
  selectedEmail: EmailDetails;
  threadEmails: EmailDetails[];
  onReply: () => void;
  isReplying: boolean;
}

const EmailHeader: React.FC<EmailHeaderProps> = ({
  selectedEmail,
  threadEmails,
  onReply,
  isReplying,
}) => {
  const [miniSummary, setMiniSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Get the subject from the most recent email in the thread
  const subject =
    threadEmails.length > 0
      ? getEmailSubject(threadEmails[0])
      : getEmailSubject(selectedEmail);

  // Get unique participants in the thread
  const getUniqueParticipants = () => {
    const participants = new Set<string>();

    threadEmails.forEach((email) => {
      // Add sender
      const sender = getEmailSender(email);
      if (sender && sender !== "Unknown Sender") {
        participants.add(parseEmailAddress(sender).name);
      }

      // Add recipients
      const recipients = getEmailRecipients(email);
      recipients.forEach((recipient) => {
        participants.add(parseEmailAddress(recipient).name);
      });

      // Add CC recipients
      const ccRecipients = getEmailCcRecipients(email);
      ccRecipients.forEach((recipient) => {
        participants.add(parseEmailAddress(recipient).name);
      });
    });

    return Array.from(participants);
  };

  // Fetch mini-summary for the most recent email
  useEffect(() => {
    const fetchMiniSummary = async () => {
      if (threadEmails.length === 0) return;

      try {
        setLoadingSummary(true);

        // Use the most recent email for the summary
        const mostRecentEmail = threadEmails[0];
        const emailBody = safeGetEmailBody(mostRecentEmail);

        const response = await fetch("http://localhost:5001/summarize-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: emailBody }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch summary: ${response.statusText}`);
        }

        const data = await response.json();
        setMiniSummary(data.mini_summary || null);
      } catch (error) {
        console.error("Error fetching email summary:", error);
        setMiniSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchMiniSummary();
  }, [threadEmails]);

  const uniqueParticipants = getUniqueParticipants();

  return (
    <div className="email-header sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <div className="flex-1 mb-3 md:mb-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {subject}
          </h1>
          <div className="flex items-center mt-1">
            <div className="text-sm text-gray-500">
              {threadEmails.length > 1
                ? `${threadEmails.length} messages in conversation`
                : "1 message"}
            </div>

            {/* Mini summary display */}
            {loadingSummary ? (
              <span className="ml-3 text-gray-400 italic text-sm">
                Loading summary...
              </span>
            ) : miniSummary ? (
              <span className="ml-3 text-blue-600 font-medium text-sm bg-blue-50 px-2 py-0.5 rounded-md">
                {miniSummary}
              </span>
            ) : null}
          </div>
        </div>

        {/* Email actions in the header */}
        <div className="flex space-x-3 self-start md:self-center">
          {!isReplying && (
            <button
              onClick={onReply}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-6 py-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium text-base border-2 border-blue-700"
              aria-label="Reply to email"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              REPLY
            </button>
          )}

          <button
            className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="More actions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Debug information - remove in production */}
      <div className="mt-2 p-2 bg-yellow-50 text-xs text-gray-700 rounded">
        Debug: Reply button should be visible above. If not, check
        EmailViewer.tsx to ensure onReply and isReplying props are passed
        correctly.
      </div>
    </div>
  );
};

export default EmailHeader;
