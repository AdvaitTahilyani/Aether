import React, { useState, useEffect } from "react";
import { LlamaService } from "../services/api/llama-service";
import { EmailDetails } from "../types";
import { getEmailSubject, getEmailSender } from "../services";
import { safeGetEmailBody } from "./EmailViewer";

interface EmailSummarizerProps {
  email: EmailDetails | null;
}

/**
 * EmailSummarizer component that provides AI-based summarization of email content.
 */
const EmailSummarizer: React.FC<EmailSummarizerProps> = ({ email }) => {
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const llamaService = new LlamaService();

  useEffect(() => {
    if (!email) return; // Handle case where email is null or undefined

    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const summary = await window.electronAPI?.storeGet(email.id);
        setSummary(summary!!); // Ensure summary is set properly
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [email]);

  const handleSummarize = async () => {
    if (!email) return;
    const summary = await window.electronAPI?.storeGet(email.id);
    if (summary) {
      setSummary(summary);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSummary("");

    try {
      const emailContent = safeGetEmailBody(email);
      const sender = getEmailSender(email);
      const subject = getEmailSubject(email);
      const finalContent = `From: ${sender}, Subject: ${subject}, Body: ${emailContent}`;
      if (!emailContent) {
        throw new Error("No email content to summarize");
      }

      const result = await llamaService.summarizeEmail(finalContent);
      setSummary(result);
      window.electronAPI?.storeSet(email.id, result);
    } catch (error) {
      console.error("Error summarizing email:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {!summary && !isLoading && (
          <div className="flex items-center">
            <button
              onClick={handleSummarize}
              className="px-2 py-1 text-xs rounded transition-colors 
                  bg-blue-600 text-white hover:bg-blue-700"
              disabled={isLoading}
              title={"Generate a summary of this email"}
            >
              "Generate Summary"
            </button>
          </div>
        )}
      </div>

      <div className="w-full">
        {isLoading && (
          <div className="flex items-center p-2 bg-gray-50 rounded text-sm">
            <svg
              className="animate-spin h-4 w-4 mr-2 text-blue-600"
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
            <span className="text-gray-700 text-sm">Generating summary...</span>
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-50 text-red-700 rounded text-xs border border-red-100">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Error: {error}</span>
            </div>
          </div>
        )}

        {summary && (
          <div className="bg-blue-50 p-3 rounded-md text-sm text-gray-800 border border-blue-100">
            {summary}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSummarizer;
