import React, { useState, useRef, useEffect } from "react";
import { EmailDetails } from "../../types";
import {
  getEmailSender,
  getEmailSubject,
  parseEmailAddress,
  checkEmailAPIAvailable,
} from "../../services";

interface EmailReplyFormProps {
  email: EmailDetails;
  threadId: string;
  onReplySuccess: () => void;
  onCancel: () => void;
}

const EmailReplyForm: React.FC<EmailReplyFormProps> = ({
  email,
  threadId,
  onReplySuccess,
  onCancel,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Get recipient information from the original email
  const sender = getEmailSender(email);
  console.log("Original sender string:", sender);

  // Extract email using regex as a more reliable method
  let recipientEmail = "";
  const emailMatch = sender.match(
    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
  );
  if (emailMatch && emailMatch[1]) {
    recipientEmail = emailMatch[1];
    console.log("Extracted email using regex:", recipientEmail);
  } else {
    // Fallback to the parseEmailAddress function
    const parsed = parseEmailAddress(sender);
    recipientEmail = parsed.email;
    console.log("Parsed recipient using parseEmailAddress:", parsed);
  }

  // Final fallback
  if (!recipientEmail || !recipientEmail.includes("@")) {
    recipientEmail = "unknown@example.com";
    console.warn("Using fallback email address");
  }

  console.log("Final recipient email:", recipientEmail);

  const subject = getEmailSubject(email);

  // Auto-focus the editor when the component mounts
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  // Format functions
  const formatText = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get content from the contentEditable div
    const content = editorRef.current?.innerHTML || "";

    if (!content.trim()) {
      setError("Please enter a reply message");
      return;
    }

    // Check if the Electron API is available
    if (!checkEmailAPIAvailable() || !window.electronAPI?.sendEmailReply) {
      setError(
        "Email API not available. Please make sure the application is running in Electron mode."
      );
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      console.log(`Sending reply to email: ${email.id}`);
      console.log(`Thread ID: ${threadId}`);
      console.log(`Recipient: ${recipientEmail}`);

      // Use the sendEmailReply method from the Electron API with the new signature
      const result = await window.electronAPI.sendEmailReply({
        emailId: email.id,
        threadId,
        content,
        to: recipientEmail,
      });

      if (result.success) {
        console.log(`Reply sent successfully! Message ID: ${result.messageId}`);
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
        onReplySuccess();
      } else {
        console.error(`Failed to send reply: ${result.error}`);
        setError(result.error || "Failed to send reply. Please try again.");
      }
    } catch (err) {
      console.error("Error sending reply:", err);
      setError(
        "An error occurred while sending your reply. Please try again later."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-reply-form border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="reply-header py-2 px-3 flex justify-between items-center bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-800 truncate">
          Reply to <span className="font-semibold">{sender}</span>
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Cancel reply"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="error-message mx-3 my-2 p-2 bg-red-50 text-red-600 rounded border border-red-200 text-sm flex-shrink-0">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-[200px] max-h-[300px]">
        {/* Formatting toolbar */}
        <div className="formatting-toolbar flex items-center space-x-1 border-b border-gray-200 p-2 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={() => formatText("bold")}
            className="p-1 rounded hover:bg-gray-200"
            title="Bold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13.5 10a2.5 2.5 0 01-2.5 2.5H6V7h5a2.5 2.5 0 012.5 2.5v.5z" />
              <path d="M10.5 15H6v-2.5h4.5a1.5 1.5 0 000-3H6V7h4.5a3.5 3.5 0 010 7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => formatText("italic")}
            className="p-1 rounded hover:bg-gray-200"
            title="Italic"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M6 5v1h2.5l-2.5 8H4v1h6v-1H7.5l2.5-8H12V5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => formatText("underline")}
            className="p-1 rounded hover:bg-gray-200"
            title="Underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M7 3C7 2.44772 6.55228 2 6 2C5.44772 2 5 2.44772 5 3V10C5 12.7614 7.23858 15 10 15C12.7614 15 15 12.7614 15 10V3C15 2.44772 14.5523 2 14 2C13.4477 2 13 2.44772 13 3V10C13 11.6569 11.6569 13 10 13C8.34315 13 7 11.6569 7 10V3Z" />
              <path d="M4 17C4 16.4477 4.44772 16 5 16H15C15.5523 16 16 16.4477 16 17C16 17.5523 15.5523 18 15 18H5C4.44772 18 4 17.5523 4 17Z" />
            </svg>
          </button>
          <div className="h-4 border-l border-gray-300 mx-1"></div>
          <button
            type="button"
            onClick={() => formatText("insertUnorderedList")}
            className="p-1 rounded hover:bg-gray-200"
            title="Bullet List"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5 4a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm-4-3a1 1 0 100-2 1 1 0 000 2zm0-6a1 1 0 100-2 1 1 0 000 2zm0 12a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => formatText("insertOrderedList")}
            className="p-1 rounded hover:bg-gray-200"
            title="Numbered List"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5 4a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm-4-10a1 1 0 011-1h1a1 1 0 010 2H2a1 1 0 01-1-1zm0 6a1 1 0 011-1h1a1 1 0 010 2H2a1 1 0 01-1-1zm0 6a1 1 0 011-1h1a1 1 0 010 2H2a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="reply-content flex-1 overflow-auto">
          <div
            ref={editorRef}
            contentEditable
            className="w-full h-full p-3 focus:outline-none text-black bg-white empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
            style={{
              color: "black",
              lineHeight: "1.5",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontSize: "14px",
              minHeight: "120px",
            }}
            data-placeholder="Type your reply here..."
          ></div>
        </div>

        <div className="reply-actions flex justify-end space-x-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            disabled={isSending}
          >
            {isSending ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Sending...
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailReplyForm;
