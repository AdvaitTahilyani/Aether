import React, { useState, useEffect } from "react";
import { EmailDetails } from "../../types";
import {
  getEmailSubject,
  getEmailSender,
  formatDetailedDate,
  getEmailRecipients,
  getEmailCcRecipients,
  parseEmailAddress,
} from "../../services";
import EmailRecipients from "./EmailRecipients";
import { safeGetEmailBody } from "./SafeEmailBody";
import { useEmailStore } from "../../store/email";

interface EmailMetadataProps {
  isExpanded: boolean;
  toggleRecipients: () => void;
}

const EmailMetadata: React.FC<EmailMetadataProps> = ({
  isExpanded,
  toggleRecipients,
}) => {
  const { currentSelectedEmail } = useEmailStore();
  const [miniSummary, setMiniSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  const sender = getEmailSender(currentSelectedEmail);
  const { name: senderName, email: senderEmail } = parseEmailAddress(sender);
  const recipients = getEmailRecipients(currentSelectedEmail);
  const ccRecipients = getEmailCcRecipients(currentSelectedEmail);

  // Fetch mini-summary for the email
  useEffect(() => {
    const fetchMiniSummary = async () => {
      if (!currentSelectedEmail?.id) return;

      try {
        setLoadingSummary(true);

        const emailBody = safeGetEmailBody(currentSelectedEmail);
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
  }, [currentSelectedEmail?.id]);

  return (
    <div className="email-metadata mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-medium text-black text-xl">
            {senderName}{" "}
            <span className="text-gray-500 font-normal">
              &lt;{senderEmail}&gt;
            </span>
          </div>
        </div>
        <div className="text-base text-gray-600">
          {formatDetailedDate(currentSelectedEmail?.internalDate)}
        </div>
      </div>

      <div className="email-metadata-row mb-2">
        <div className="email-metadata-label text-base font-medium text-gray-700">
          Subject:
        </div>
        <div className="email-metadata-value text-black font-medium text-base">
          {getEmailSubject(currentSelectedEmail)}
        </div>
      </div>

      {/* Recipients */}
      <EmailRecipients
        recipients={recipients}
        isExpanded={isExpanded}
        toggleRecipients={toggleRecipients}
        type="to"
      />

      {/* CC Recipients - only show if there are any */}
      {ccRecipients.length > 0 && (
        <EmailRecipients
          recipients={ccRecipients}
          isExpanded={isExpanded}
          toggleRecipients={toggleRecipients}
          type="cc"
        />
      )}

      {/* Show less button when expanded */}
      {isExpanded && (recipients.length > 3 || ccRecipients.length > 3) && (
        <div className="mt-2 ml-10">
          <button
            onClick={toggleRecipients}
            className="text-blue-600 hover:underline text-base"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailMetadata;
