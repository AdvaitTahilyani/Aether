import React from "react";

const NoEmailSelected: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center p-8 bg-white text-gray-500">
      <div className="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 mx-auto mb-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-xl font-medium mb-2">No Email Selected</h3>
        <p>Select an email from the list to view its contents</p>
      </div>
    </div>
  );
};

export default NoEmailSelected;
