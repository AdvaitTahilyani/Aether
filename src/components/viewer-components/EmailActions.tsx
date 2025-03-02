import React, { useState } from "react";
import { EmailDetails } from "../../types";
import { checkEmailAPIAvailable } from "../../services";

interface EmailActionsProps {
  email: EmailDetails;
  onReply: () => void;
  onForward?: () => void;
  onDelete?: () => void;
}

const EmailActions: React.FC<EmailActionsProps> = ({ email, onReply, onForward, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!email.id) return;
    
    setIsDeleting(true);
    try {
      if (checkEmailAPIAvailable() && window.electronAPI?.deleteEmail) {
        const success = await window.electronAPI.deleteEmail(email.id);
        if (success && onDelete) {
          onDelete();
        } else {
          console.error("Failed to delete email");
        }
      } else {
        console.error("Email API not available");
      }
    } catch (error) {
      console.error("Error deleting email:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForward = () => {
    if (onForward) {
      onForward();
    }
  };

  return (
    <div className="email-actions flex gap-3">
      <button
        onClick={onReply}
        className="flex items-center text-xs text-white hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm font-medium"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 mr-1.5"
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
        Reply
      </button>

      <button 
        onClick={handleForward}
        className="flex items-center text-xs text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 rounded-full px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm font-medium"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 mr-1.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Forward
      </button>
      
      <button 
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center text-xs text-gray-700 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 rounded-full px-3 py-1.5 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? (
          <svg className="animate-spin h-3.5 w-3.5 mr-1.5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        )}
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
};

export default EmailActions;
