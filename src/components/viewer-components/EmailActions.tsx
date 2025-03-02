import React from "react";
import { EmailDetails } from "../../types";

interface EmailActionsProps {
  email: EmailDetails;
  onReply: () => void;
}

const EmailActions: React.FC<EmailActionsProps> = ({ email, onReply }) => {
  return (
    <div className="email-actions flex gap-2">
      <button
        onClick={onReply}
        className="flex items-center text-xs text-white hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md px-2 py-1 bg-blue-600 hover:bg-blue-700 border border-blue-700 shadow-sm font-medium"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 mr-1"
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

      <button className="flex items-center text-xs text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 shadow-sm font-medium">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 mr-1"
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
    </div>
  );
};

export default EmailActions;
