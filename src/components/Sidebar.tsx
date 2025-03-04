import React, { useState } from "react";

export type EmailCategory = "inbox" | "starred" | "sent" | "spam" | "trash";

interface SidebarProps {
  currentCategory: EmailCategory;
  onCategoryChange: (category: EmailCategory) => void;
  onComposeClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onCategoryChange,
  onComposeClick,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div
      className={`h-full bg-[#121212] border-r border-white/20 transition-all duration-300 flex flex-col ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="p-4 text-gray-400 hover:text-white self-end"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <img
          src="/icons/collapse-icon.svg"
          alt="Toggle sidebar"
          className={`h-5 w-5 transition-transform duration-300 ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Compose button */}
      <button
        onClick={onComposeClick}
        className={`w-full flex items-center p-3 rounded-lg transition-colors text-gray-400 hover:bg-white/10 hover:text-white ${
          collapsed ? "justify-center" : "justify-start"
        }`}
        aria-label="Compose"
      >
        <img src="/icons/compose-icon.svg" alt="Compose" className="h-5 w-5" />
        {!collapsed && (
          <span className="ml-3 text-sm font-medium">Compose</span>
        )}
      </button>

      {/* Categories */}
      <nav className="flex-1 mt-4">
        <ul className="space-y-2 px-2">
          <li>
            <button
              onClick={() => onCategoryChange("inbox")}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentCategory === "inbox"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center" : "justify-start"}`}
              aria-label="Inbox"
            >
              <img
                src="/icons/inbox-icon.svg"
                alt="Inbox"
                className="h-5 w-5 flex-shrink-0"
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">Inbox</span>
              )}
            </button>
          </li>

          <li>
            <button
              onClick={() => onCategoryChange("starred")}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentCategory === "starred"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center" : "justify-start"}`}
              aria-label="Starred"
            >
              <img
                src="/icons/starred-icon.svg"
                alt="Starred"
                className="h-5 w-5 flex-shrink-0"
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">Starred</span>
              )}
            </button>
          </li>

          <li>
            <button
              onClick={() => onCategoryChange("sent")}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentCategory === "sent"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center" : "justify-start"}`}
              aria-label="Sent"
            >
              <img
                src="/icons/sent-icon.svg"
                alt="Sent"
                className="h-5 w-5 flex-shrink-0"
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">Sent</span>
              )}
            </button>
          </li>

          <li>
            <button
              onClick={() => onCategoryChange("spam")}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentCategory === "spam"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center" : "justify-start"}`}
              aria-label="Spam"
            >
              <img
                src="/icons/spam-icon.svg"
                alt="Spam"
                className="h-5 w-5 flex-shrink-0"
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">Spam</span>
              )}
            </button>
          </li>

          <li>
            <button
              onClick={() => onCategoryChange("trash")}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentCategory === "trash"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              } ${collapsed ? "justify-center" : "justify-start"}`}
              aria-label="Trash"
            >
              <img
                src="/icons/trash-icon.svg"
                alt="Trash"
                className="h-5 w-5 flex-shrink-0"
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">Trash</span>
              )}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
