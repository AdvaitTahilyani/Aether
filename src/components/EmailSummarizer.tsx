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
  const [summaries, setSummaries] = useState<{ [id: string]: string }>({});
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAvailable, setServerAvailable] = useState<boolean>(false);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

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
  

  // Check if the server is available
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const status = await llamaService.getServerStatus();
        setServerAvailable(status.serverAvailable);
        setOllamaAvailable(status.ollamaAvailable);
        setStatusMessage(status.message);

        if (!status.serverAvailable) {
          console.log(
            "AI server is not available. Please make sure the Flask server is running on port 5000."
          );
        } else if (!status.ollamaAvailable) {
          console.log(
            "Ollama is not available. Please make sure Ollama is running and the Llama 3 model is installed."
          );
        }
      } catch (error) {
        console.error("Error checking server status:", error);
        setServerAvailable(false);
        setOllamaAvailable(false);
        setStatusMessage("Failed to connect to the server");
      }
    };

    checkServerStatus();

    // Set up an interval to check server status every 30 seconds
    const intervalId = setInterval(checkServerStatus, 30000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleSummarize = async () => {
    if (!email || !serverAvailable || !ollamaAvailable) return;
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
      const ret = window.electronAPI?.storeSet(email.id, result);
    } catch (error) {
      console.error("Error summarizing email:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) return null;

  // Determine the status badge text and color
  const getStatusBadge = () => {
    if (!serverAvailable) {
      return {
        text: "Server Offline",
        class: "bg-red-100 text-red-700",
      };
    } else if (!ollamaAvailable) {
      return {
        text: "Ollama Offline",
        class: "bg-yellow-100 text-yellow-700",
      };
    }
    return null;
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {!summary && !isLoading && (
          <div className="flex items-center">
            {(!serverAvailable || !ollamaAvailable) && (
              <a
                href="server/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 mr-2 underline"
                title="View instructions on how to start the AI server"
              >
                Server Setup Guide
              </a>
            )}
            <button
              onClick={handleSummarize}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                serverAvailable && ollamaAvailable
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!serverAvailable || !ollamaAvailable || isLoading}
              title={
                !serverAvailable
                  ? "AI server is not available. Please start the Flask server."
                  : !ollamaAvailable
                  ? "Ollama is not available. Please make sure Ollama is running and the Llama 3 model is installed."
                  : "Generate a summary of this email"
              }
            >
              {!serverAvailable
                ? "AI Server Unavailable"
                : !ollamaAvailable
                ? "Ollama Unavailable"
                : "Generate Summary"}
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

        {!serverAvailable && (
          <div className="p-2 bg-red-50 text-red-700 rounded text-xs border border-red-100 mt-2">
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
              <span>AI Server Offline</span>
            </div>
            <div className="mt-1 text-xs">
              <p>Please start the Flask server to use AI summarization.</p>
              <a
                href="server/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View setup guide
              </a>
            </div>
          </div>
        )}

        {serverAvailable && !ollamaAvailable && (
          <div className="p-2 bg-yellow-50 text-yellow-700 rounded text-xs border border-yellow-100 mt-2">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-yellow-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Ollama Unavailable</span>
            </div>
            <div className="mt-1 text-xs">
              <p>Please make sure Ollama is running and the Llama 3 model is installed.</p>
              <a
                href="server/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View setup guide
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSummarizer;
