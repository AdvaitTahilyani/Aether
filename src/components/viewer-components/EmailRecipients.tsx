import React from "react";
import { parseEmailAddress } from "../../services";

interface EmailRecipientsProps {
  recipients: string[];
  isExpanded: boolean;
  toggleRecipients: () => void;
  type: "to" | "cc";
}

const EmailRecipients: React.FC<EmailRecipientsProps> = ({
  recipients,
  isExpanded,
  toggleRecipients,
  type,
}) => {
  if (recipients.length === 0) {
    return null;
  }

  return (
    <div className="email-metadata-row mb-2">
      <div className="email-metadata-label text-base font-medium text-gray-700">
        {type === "to" ? "To:" : "Cc:"}
      </div>
      <div className="email-metadata-value text-base">
        {recipients.length <= 3 || isExpanded ? (
          <div>
            {recipients.map((recipient, i) => {
              const { name, email } = parseEmailAddress(recipient);
              return (
                <div key={i} className="email-recipient">
                  <span className="email-recipient-name">{name}</span>{" "}
                  <span className="email-recipient-email text-gray-500">
                    &lt;{email}&gt;
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {recipients.slice(0, 2).map((recipient, i) => {
              const { name, email } = parseEmailAddress(recipient);
              return (
                <div key={i} className="email-recipient">
                  <span className="email-recipient-name">{name}</span>{" "}
                  <span className="email-recipient-email text-gray-500">
                    &lt;{email}&gt;
                  </span>
                </div>
              );
            })}
            <button
              onClick={toggleRecipients}
              className="text-blue-600 hover:underline text-base"
            >
              Show {recipients.length - 2} more...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailRecipients;
