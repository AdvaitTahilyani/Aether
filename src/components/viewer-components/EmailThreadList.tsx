import React, { RefObject } from "react";
import { EmailDetails } from "../../types";
import EmailMetadata from "./EmailMetadata";
import EmailBody from "./EmailBody";
import EmailActions from "./EmailActions";

interface EmailThreadListProps {
  threadEmails: EmailDetails[];
  expandedRecipients: Set<string>;
  toggleRecipients: (emailId: string) => void;
  iframeRef: RefObject<HTMLIFrameElement>;
  loading: boolean;
  error: string | null;
  onReplySuccess?: () => void;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
  onReply?: () => void;
}

const EmailThreadList: React.FC<EmailThreadListProps> = ({
  threadEmails,
  expandedRecipients,
  toggleRecipients,
  iframeRef,
  loading,
  error,
  onReplySuccess,
  replyingToId,
  setReplyingToId,
  onReply,
}) => {
  // Handle starting a reply to an email
  const handleReply = (emailId: string) => {
    setReplyingToId(emailId);
    if (onReply) {
      onReply();
    }
  };

  return (
    <div className="flex-1 overflow-auto h-full">
      {loading && (
        <div className="flex justify-center items-center h-16 py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 mx-4 my-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Display each email in the thread */}
      <div className="w-full">
        {threadEmails.map((email, index) => {
          const isExpanded = expandedRecipients.has(email.id);
          const isReplying = email.id && replyingToId === email.id;

          return (
            <div
              key={email.id || index}
              className="email-message border-b border-gray-200 bg-white"
            >
              <div className="px-4 py-2">
                {/* Email metadata */}
                <EmailMetadata
                  email={email}
                  isExpanded={isExpanded}
                  toggleRecipients={() => toggleRecipients(email.id)}
                />

                {/* Email body */}
                <EmailBody
                  email={email}
                  index={index}
                  isFirstEmail={index === 0}
                  iframeRef={index === 0 ? iframeRef : null}
                />

                {/* Email actions - show only if not replying */}
                {!replyingToId && (
                  <div className="mt-2 flex justify-end">
                    <EmailActions
                      email={email}
                      onReply={() => handleReply(email.id)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmailThreadList;
