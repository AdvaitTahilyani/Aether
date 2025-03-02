import React, { useState } from "react";

interface EmailFiltersProps {
  tags: string[];
  activeTagFilter: string | null;
  onTagClick: (tag: string) => void;
  onClearFilter: () => void;
  getTagColor: (tag: string) => string;
}

const EmailFilters: React.FC<EmailFiltersProps> = ({
  tags,
  activeTagFilter,
  onTagClick,
  onClearFilter,
  getTagColor,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleFilters = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative">
      {/* Filter toggle button */}
      <button
        onClick={toggleFilters}
        className="flex items-center text-sm text-white/70 hover:text-white transition-colors"
        aria-label="Toggle filters"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 mr-1"
        >
          <path
            fillRule="evenodd"
            d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
            clipRule="evenodd"
          />
        </svg>
        <span>{isExpanded ? "Hide Filters" : "Show Filters"}</span>
        {activeTagFilter && (
          <span className="ml-2 px-2 py-0.5 bg-blue-500/30 rounded-full text-xs">
            1
          </span>
        )}
      </button>

      {/* Filters panel */}
      {isExpanded && (
        <div className="mt-3 mb-3 animate-fadeIn">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              // Get the color for this tag from the label map
              const tagColor = getTagColor(tag);

              return (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    activeTagFilter === tag
                      ? "bg-opacity-100 text-white"
                      : "bg-opacity-20 hover:bg-opacity-30"
                  }`}
                  style={{
                    backgroundColor:
                      activeTagFilter === tag ? tagColor : `${tagColor}20`,
                    color: activeTagFilter === tag ? "white" : tagColor,
                    border: `1px solid ${tagColor}`,
                  }}
                >
                  {tag}
                  {activeTagFilter === tag && <span className="ml-2">×</span>}
                </button>
              );
            })}
          </div>

          {activeTagFilter && (
            <div className="mt-3 text-sm">
              <button
                onClick={onClearFilter}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailFilters;
