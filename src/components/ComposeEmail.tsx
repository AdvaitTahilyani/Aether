import React, { useState, useEffect, useRef } from "react";
import { isElectronAPIAvailable } from "../services";
import { EmailDetails } from "../types";
import { getEmailSender, getEmailSubject, parseEmailAddress } from "../services";
import AutoReplyGenerator from "./AutoReplyGenerator";

interface ComposeEmailProps {
  userEmail?: string;
  onClose: () => void;
  onSent?: () => void;
  // Reply-specific props
  isReply?: boolean;
  replyToEmail?: EmailDetails;
  replyToSubject?: string;
  replyToAddress?: string;
}

const ComposeEmail: React.FC<ComposeEmailProps> = ({
  userEmail,
  onClose,
  onSent,
  isReply = false,
  replyToEmail,
  replyToSubject,
  replyToAddress,
}) => {
  const [to, setTo] = useState(isReply && replyToAddress ? replyToAddress : '');
  const [cc, setCc] = useState<string>("");
  const [bcc, setBcc] = useState<string>("");
  const [showCc, setShowCc] = useState<boolean>(false);
  const [showBcc, setShowBcc] = useState<boolean>(false);
  const [subject, setSubject] = useState(
    isReply && replyToSubject ? `Re: ${replyToSubject}` : ''
  );
  const [body, setBody] = useState<string>("");
  const [suggestedReply, setSuggestedReply] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string>("Checking API...");
  const [isAiReplyActive, setIsAiReplyActive] = useState<boolean>(false);
  const [isCheckingStoredReply, setIsCheckingStoredReply] = useState<boolean>(isReply);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper function to create a consistent key for storing replies
  const getReplyStoreKey = (emailId: string): string => {
    return `auto-reply-${emailId}`;
  };

  // Initialize fields for reply
  useEffect(() => {
    if (isReply && replyToEmail) {
      // Get recipient information from the original email
      const sender = getEmailSender(replyToEmail);
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
      
      // Set the recipient
      setTo(recipientEmail);
      
      // Set the subject with Re: prefix if it doesn't already have one
      const originalSubject = getEmailSubject(replyToEmail);
      const replySubject = originalSubject.startsWith("Re:") 
        ? originalSubject 
        : `Re: ${originalSubject}`;
      setSubject(replySubject);

      // Check for stored reply
      checkStoredReply();
    }
  }, [isReply, replyToEmail]);

  // Check if a stored reply exists for this email
  const checkStoredReply = async () => {
    if (!replyToEmail || !replyToEmail.id || !isElectronAPIAvailable() || !window.electronAPI?.storeGet) {
      return;
    }

    try {
      setIsCheckingStoredReply(true);
      const storeKey = getReplyStoreKey(replyToEmail.id);
      const storedReply = await window.electronAPI.storeGet(storeKey);
      
      if (storedReply) {
        console.log('Using stored reply for email:', replyToEmail.id);
        handleReplyGenerated(storedReply);
      }
    } catch (err) {
      console.error('Error checking stored reply:', err);
    } finally {
      setIsCheckingStoredReply(false);
    }
  };

  // Check if the sendEmail function is available
  useEffect(() => {
    if (isElectronAPIAvailable()) {
      const api = window.electronAPI;
      console.log("Electron API available:", api);
      console.log("API methods:", Object.keys(api || {}));

      if (api && typeof api.sendEmail === "function") {
        setApiStatus("sendEmail function is available");
      } else {
        setApiStatus("sendEmail function is NOT available");
        setError(
          "Email sending is not available. The application may need to be restarted."
        );
      }
    } else {
      setApiStatus("Electron API is not available");
      setError(
        "Electron API is not available. The application may need to be restarted."
      );
    }

    // Log the userEmail prop to debug
    console.log("User email prop:", userEmail);
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      // Use the Electron API to send emails instead of the mock function
      if (!isElectronAPIAvailable() || !window.electronAPI?.sendEmail) {
        throw new Error("Email sending functionality is not available");
      }

      const result = await window.electronAPI.sendEmail({
        to,
        cc: showCc ? cc : undefined,
        bcc: showBcc ? bcc : undefined,
        subject,
        body,
        isHtml: false, // Set to true if you want to send HTML emails
        threadId: isReply && replyToEmail ? replyToEmail.threadId : undefined
      });

      if (!result || !result.success) {
        throw new Error("Failed to send email");
      }

      setSending(false);
      if (onSent) {
        onSent();
      }
      onClose();
    } catch (err) {
      setSending(false);
      setError('Failed to send email. Please try again.');
      console.error('Error sending email:', err);
    }
  };

  // Handle auto-reply generation
  const handleReplyGenerated = (reply: string) => {
    // Only set the suggested reply if we don't already have one
    if (!suggestedReply) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Reply generated:', reply);
      }
      setSuggestedReply(reply);
      setBody(reply);
      setIsAiReplyActive(true);
      setIsCheckingStoredReply(false);
    }
  };

  // Handle key events in the textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Tab is pressed and AI reply is active, keep the reply and deactivate AI mode
    if (e.key === 'Tab' && isAiReplyActive) {
      e.preventDefault();
      setIsAiReplyActive(false);
      if (textareaRef.current) {
        // Place cursor at the end of the text
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }
      return;
    }

    // If Escape is pressed and AI reply is active, clear the reply
    if (e.key === 'Escape' && isAiReplyActive) {
      e.preventDefault();
      setBody('');
      setIsAiReplyActive(false);
      return;
    }

    // If any other key is pressed (except for navigation keys), deactivate AI mode
    if (isAiReplyActive &&
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'Home' &&
        e.key !== 'End' &&
        e.key !== 'PageUp' &&
        e.key !== 'PageDown') {
      // Let the default behavior happen (user typing will replace the selected text)
      setIsAiReplyActive(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/90 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#222222] rounded-md shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-gray-300 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2A2A2A]">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            {isReply ? "Reply to Message" : "New Message"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Auto-reply generator (invisible component) - only generate if we don't have a stored reply */}
        {isReply && replyToEmail && !isCheckingStoredReply && !suggestedReply && (
          <AutoReplyGenerator 
            email={replyToEmail} 
            onReplyGenerated={handleReplyGenerated} 
            userEmail={userEmail}
          />
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#222222]"
        >
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 mx-4 my-2 rounded">
              <p>{error}</p>
            </div>
          )}

          {/* To Field */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label htmlFor="to" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              To
            </label>
            <input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              required
              className="w-full bg-white dark:bg-[#333333] text-gray-700 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-2 flex space-x-4">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  + Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  + Bcc
                </button>
              )}
            </div>
          </div>

          {/* CC Field (Optional) */}
          {showCc && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <label htmlFor="cc" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Cc
              </label>
              <div className="flex">
                <input
                  id="cc"
                  type="email"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="w-full bg-white dark:bg-[#333333] text-gray-700 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCc(false)}
                  className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* BCC Field (Optional) */}
          {showBcc && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <label htmlFor="bcc" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Bcc
              </label>
              <div className="flex">
                <input
                  id="bcc"
                  type="email"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="w-full bg-white dark:bg-[#333333] text-gray-700 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBcc(false)}
                  className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Subject Field */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <label
              htmlFor="subject"
              className="block text-sm text-gray-600 dark:text-gray-400 mb-1"
            >
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-white dark:bg-[#333333] text-gray-700 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Body Field - Increased height with min-h-[300px] */}
          <div className="p-4 flex-1 overflow-hidden relative">
            <div className="relative w-full h-full min-h-[300px]">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  // If user manually changes text, deactivate AI reply mode
                  if (isAiReplyActive) {
                    setIsAiReplyActive(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Write your message here..."
                className={`w-full h-full min-h-[300px] p-4 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-300 dark:border-gray-600
                  ${isAiReplyActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-[#333333] text-gray-700 dark:text-white'}`}
              ></textarea>
              
              {/* Tab instruction - only visible when AI reply is active */}
              {isAiReplyActive && (
                <div className="absolute top-3 right-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full shadow-sm z-30">
                  Press Tab to keep
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 mr-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sending}
            >
              {sending ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              ) : isReply ? (
                "Send Reply"
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeEmail;
