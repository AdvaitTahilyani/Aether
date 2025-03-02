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
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 mx-4 my-3 rounded-lg text-sm shadow-sm border border-red-100">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Display each email in the thread */}
      <div className="w-full pt-3 space-y-4">
        {threadEmails.map((email, index) => {
          const isExpanded = expandedRecipients.has(email.id);
          const isReplying = email.id && replyingToId === email.id;
          const isLastEmail = index === threadEmails.length - 1;

          return (
            <div
              key={email.id || index}
              className={`email-message bg-white mx-4 rounded-lg ${
                index === 0 ? "shadow-md" : "shadow-sm"
              } ${isLastEmail ? "" : "mb-4"}`}
            >
              <div className="px-5 py-3">
                {/* Email metadata */}
                <EmailMetadata
                  email={email}
                  isExpanded={isExpanded}
                  toggleRecipients={() => toggleRecipients(email.id)}
                />

                {/* Email body */}
                <div className="mt-3">
                  <EmailBody
                    email={email}
                    index={index}
                    isFirstEmail={index === 0}
                    iframeRef={index === 0 ? iframeRef : null}
                  />
                </div>

                {/* Email actions - show only if not replying */}
                {!replyingToId && (
                  <div className="mt-4 flex justify-end">
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
