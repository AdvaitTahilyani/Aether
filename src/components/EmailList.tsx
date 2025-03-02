import React, { useMemo, useState, useRef, useEffect } from "react";
import { EmailDetails } from "../types";
import {
  getEmailSubject,
  getEmailSender,
  formatDate,
  getEmailLabels,
  checkEmailAPIAvailable,
  deleteEmail,
} from "../services";
import EmailFilters from "./EmailFilters";
import { EmailCategory } from "./Sidebar";

interface EmailListProps {
  emails: EmailDetails[];
  loading: boolean;
  error: string | null;
  onSelectEmail: (email: EmailDetails) => void;
  selectedEmailId: string | null;
  onRefresh: () => void; // Add callback to refresh emails after deletion
  onPermissionError?: () => void; // Add callback for permission errors
  category?: EmailCategory; // Add category prop
}

// Helper function to safely check if an email has valid headers
const hasValidHeaders = (email: EmailDetails): boolean => {
  return !!(
    email &&
    email.payload &&
    Array.isArray(email.payload.headers) &&
    email.payload.headers.length > 0
  );
};

const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  error,
  onSelectEmail,
  selectedEmailId,
  onRefresh,
  onPermissionError,
  category = "inbox", // Default to inbox
}) => {
  // Debug: Log emails when they change
  useEffect(() => {
    console.log(`EmailList received ${category} emails:`, emails);
    if (emails.length > 0) {
      // Log the structure of the first email for debugging
      console.log("First email structure:", JSON.stringify(emails[0], null, 2));

      // Check if essential fields are present
      const missingFields = emails.filter(
        (email) => !email.id || !email.threadId || !hasValidHeaders(email)
      );

      if (missingFields.length > 0) {
        console.warn(
          `${missingFields.length} emails are missing essential fields`
        );
      }

      // Check if we can extract subjects and senders
      try {
        const firstSubject = getEmailSubject(emails[0]);
        const firstSender = getEmailSender(emails[0]);
        console.log("First email subject:", firstSubject);
        console.log("First email sender:", firstSender);
      } catch (err) {
        console.error("Error extracting email metadata:", err);
      }
    }
  }, [emails, category]);

  // State for active tag filter
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  // State for tracking emails being deleted (for animation)
  const [deletingEmails, setDeletingEmails] = useState<Set<string>>(new Set());
  // State for tracking delete operation status
  const [deleteStatus, setDeleteStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  // State for tracking starred emails (for immediate UI updates)
  const [starredEmails, setStarredEmails] = useState<Set<string>>(new Set());
  // Ref for delete sound
  const deleteSoundRef = useRef<HTMLAudioElement | null>(null);
  // Ref for the email list container
  const emailListRef = useRef<HTMLDivElement>(null);

  // Initialize starredEmails set from the emails prop
  useEffect(() => {
    const initialStarredEmails = new Set<string>();
    emails.forEach((email) => {
      if (email.labelIds?.includes("STARRED")) {
        initialStarredEmails.add(email.id);
      }
    });
    setStarredEmails(initialStarredEmails);
  }, [emails]);

  // Extract all unique tags/labels from emails with custom priority order
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();

    emails.forEach((email) => {
      const labels = getEmailLabels(email);
      labels.forEach((label) => {
        // Skip the Inbox tag as it's the default view
        if (label.name !== "Inbox") {
          tagSet.add(label.name);
        }
      });
    });

    // Convert to array for sorting
    const tagsArray = Array.from(tagSet);

    // Define priority order for tags
    const tagPriority: Record<string, number> = {
      Important: 1,
      Updates: 2,
      Unread: 3,
      Starred: 4,
      Personal: 5,
      Promotions: 6,
      Social: 7,
      Forums: 8,
      // Other tags will be sorted alphabetically after these
    };

    // Sort tags by priority, then alphabetically
    return tagsArray.sort((a, b) => {
      const priorityA = tagPriority[a] || 100;
      const priorityB = tagPriority[b] || 100;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically
      return a.localeCompare(b);
    });
  }, [emails]);

  // Group emails by thread ID
  const groupedEmails = useMemo(() => {
    const threadMap = new Map<string, EmailDetails[]>();

    // Group emails by threadId
    emails.forEach((email) => {
      const threadId = email.threadId || email.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(email);
    });

    // Sort threads by date (most recent first)
    const sortedThreads = Array.from(threadMap.entries()).map(
      ([threadId, emails]) => {
        // Sort emails within thread by date (newest first)
        const sortedEmails = emails.sort(
          (a, b) =>
            parseInt(b.internalDate || "0") - parseInt(a.internalDate || "0")
        );

        return {
          threadId,
          emails: sortedEmails,
          // Use the most recent email as the thread representative
          latestEmail: sortedEmails[0],
          count: sortedEmails.length,
        };
      }
    );

    // Sort threads by the date of their most recent email
    return sortedThreads.sort(
      (a, b) =>
        parseInt(b.latestEmail.internalDate || "0") -
        parseInt(a.latestEmail.internalDate || "0")
    );
  }, [emails]);

  // Filter threads based on active tag
  const filteredThreads = useMemo(() => {
    if (!activeTagFilter) {
      return groupedEmails;
    }

    return groupedEmails.filter(({ emails }) => {
      // Special case for "Important" tag - exclude promotional emails
      if (activeTagFilter === "Important") {
        return emails.some((email) => {
          const labels = getEmailLabels(email);

          // Check if this email has the Important tag
          const hasImportantTag = labels.some(
            (label) => label.name === "Important"
          );

          // Check if this email has any promotional category tags
          const hasPromotionalTag = labels.some((label) =>
            ["Promotions", "Social", "Forums"].includes(label.name)
          );

          // Only include if it has the Important tag AND doesn't have promotional tags
          return hasImportantTag && !hasPromotionalTag;
        });
      }

      // For other tags, use the standard filtering
      return emails.some((email) => {
        const labels = getEmailLabels(email);
        return labels.some((label) => label.name === activeTagFilter);
      });
    });
  }, [groupedEmails, activeTagFilter]);

  // Handle tag filter click
  const handleTagClick = (tagName: string) => {
    setActiveTagFilter((prev) => (prev === tagName ? null : tagName));
  };

  // Helper function to get color for a tag
  const getTagColor = (tagName: string): string => {
    // Define colors for each tag type (matching the colors in getEmailLabels)
    const tagColors: Record<string, string> = {
      Important: "#d93025",
      Starred: "#f4b400",
      Unread: "#1a73e8",
      Inbox: "#188038",
      Sent: "#1a73e8",
      Draft: "#a142f4",
      Spam: "#d93025",
      Trash: "#5f6368",
      Personal: "#1a73e8",
      Social: "#1e8e3e",
      Promotions: "#fbbc04",
      Updates: "#a142f4",
      Forums: "#f5b400",
    };

    return tagColors[tagName] || "#1a73e8"; // Default to blue if tag not found
  };

  // Handle email deletion
  const handleDeleteEmail = async (
    email: EmailDetails,
    event: React.MouseEvent
  ) => {
    // Stop event propagation to prevent selecting the email when clicking delete
    event.stopPropagation();

    if (!checkEmailAPIAvailable()) {
      setDeleteStatus({
        message: "Delete functionality not available",
        isError: true,
      });
      return;
    }

    try {
      // Add email to deleting set for animation
      setDeletingEmails((prev) => new Set(prev).add(email.id));

      // Play delete sound
      if (deleteSoundRef.current) {
        deleteSoundRef.current.currentTime = 0;
        deleteSoundRef.current
          .play()
          .catch((err) => console.error("Error playing sound:", err));
      }

      // Wait for animation to complete (500ms)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Call Gmail API to delete the email
      const success = await deleteEmail(email.id);

      if (!success) {
        throw new Error("Failed to delete email");
      }

      // Show success message
      setDeleteStatus({
        message: "Email deleted successfully",
        isError: false,
      });

      // Clear message after 3 seconds
      setTimeout(() => setDeleteStatus(null), 3000);

      // Refresh email list
      onRefresh();
    } catch (error) {
      console.error("Error deleting email:", error);

      // Check for permission errors
      let errorMessage = "Failed to delete email";
      let needsRelogin = false;

      if (error instanceof Error) {
        if (error.message.includes("Insufficient Permission")) {
          errorMessage =
            "You don't have permission to delete emails. Please log out and log in again with the required permissions.";
          needsRelogin = true;

          // Notify parent component about permission error
          if (onPermissionError) {
            onPermissionError();
          }
        } else {
          errorMessage = error.message;
        }
      }

      setDeleteStatus({
        message: errorMessage,
        isError: true,
      });

      // If this is a permission issue, show a more prominent notification
      if (needsRelogin) {
        // Keep the error message visible for longer
        setTimeout(() => {
          setDeleteStatus({
            message:
              "Please log out and log in again to grant the necessary permissions.",
            isError: true,
          });
        }, 5000);
      } else {
        // Clear other error messages after 3 seconds
        setTimeout(() => setDeleteStatus(null), 3000);
      }

      // Remove email from deleting set if there was an error
      setDeletingEmails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(email.id);
        return newSet;
      });
    }
  };

  // Handle toggling star status
  const handleToggleStar = async (
    email: EmailDetails,
    event: React.MouseEvent
  ) => {
    // Stop event propagation to prevent selecting the email when clicking star
    event.stopPropagation();

    if (!checkEmailAPIAvailable()) {
      setDeleteStatus({
        message: "Star functionality not available",
        isError: true,
      });
      return;
    }

    try {
      // Optimistically update UI
      setStarredEmails((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(email.id)) {
          newSet.delete(email.id);
        } else {
          newSet.add(email.id);
        }
        return newSet;
      });

      // Call API to toggle star status
      const result = await window.electronAPI!.toggleStarEmail(email.id);

      // If API call fails, revert the UI change
      if (!result || !result.success) {
        setStarredEmails((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(email.id)) {
            newSet.delete(email.id);
          } else {
            newSet.add(email.id);
          }
          return newSet;
        });
        throw new Error("Failed to toggle star status");
      }

      // Show success message
      setDeleteStatus({
        message: result.isStarred ? "Email starred" : "Email unstarred",
        isError: false,
      });

      // Clear message after 2 seconds
      setTimeout(() => setDeleteStatus(null), 2000);
    } catch (error) {
      console.error("Error toggling star status:", error);

      // Check for permission errors
      let errorMessage = "Failed to toggle star status";
      let needsRelogin = false;

      if (error instanceof Error) {
        if (error.message.includes("Insufficient Permission")) {
          errorMessage =
            "You don't have permission to modify emails. Please log out and log in again with the required permissions.";
          needsRelogin = true;

          // Notify parent component about permission error
          if (onPermissionError) {
            onPermissionError();
          }
        } else {
          errorMessage = error.message;
        }
      }

      setDeleteStatus({
        message: errorMessage,
        isError: true,
      });

      // If this is a permission issue, show a more prominent notification
      if (needsRelogin) {
        // Keep the error message visible for longer
        setTimeout(() => {
          setDeleteStatus({
            message:
              "Please log out and log in again to grant the necessary permissions.",
            isError: true,
          });
        }, 5000);
      } else {
        // Clear other error messages after 3 seconds
        setTimeout(() => setDeleteStatus(null), 3000);
      }
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if we have emails and a selected email
      if (filteredThreads.length === 0 || !selectedEmailId) return;

      // Find the index of the currently selected email
      const currentIndex = filteredThreads.findIndex(
        ({ latestEmail }) => latestEmail.id === selectedEmailId
      );

      if (currentIndex === -1) return;

      let newIndex = currentIndex;

      // Handle arrow up/down navigation
      if (e.key === "ArrowDown") {
        // Move to next email if not at the end
        if (currentIndex < filteredThreads.length - 1) {
          newIndex = currentIndex + 1;
        }
      } else if (e.key === "ArrowUp") {
        // Move to previous email if not at the beginning
        if (currentIndex > 0) {
          newIndex = currentIndex - 1;
        }
      } else {
        // Not an arrow key we're handling
        return;
      }

      // If the index changed, select the new email
      if (newIndex !== currentIndex) {
        e.preventDefault(); // Prevent default scrolling
        const newEmail = filteredThreads[newIndex].latestEmail;
        onSelectEmail(newEmail);

        // Scroll the email into view if needed
        const emailElements =
          emailListRef.current?.querySelectorAll(".email-item");
        if (emailElements && emailElements[newIndex]) {
          emailElements[newIndex].scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredThreads, selectedEmailId, onSelectEmail]);

  // Get category title for display
  const getCategoryTitle = (): string => {
    switch (category) {
      case "inbox":
        return "Inbox";
      case "starred":
        return "Starred";
      case "sent":
        return "Sent";
      case "spam":
        return "Spam";
      case "trash":
        return "Trash";
      default:
        return "Inbox";
    }
  };

  return (
    <div className="overflow-auto max-h-[calc(100vh-120px)]">
      {/* Delete sound effect (hidden audio element) */}
      <audio ref={deleteSoundRef} className="hidden">
        <source src="/sounds/swoosh.mp3" type="audio/mpeg" />
      </audio>

      <div className="p-6 border-b border-white/30 flex-shrink-0">
        {/* Header with title and refresh button */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold tracking-tight">
            {getCategoryTitle()}
          </h2>
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Refresh emails"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Email filters component */}
        {allTags.length > 0 && (
          <EmailFilters
            tags={allTags}
            activeTagFilter={activeTagFilter}
            onTagClick={handleTagClick}
            onClearFilter={() => setActiveTagFilter(null)}
            getTagColor={getTagColor}
          />
        )}

        {/* Status message */}
        {deleteStatus && (
          <div
            className={`mt-3 p-2 rounded text-sm ${
              deleteStatus.isError
                ? "bg-red-500/20 text-red-300"
                : "bg-green-500/20 text-green-300"
            }`}
          >
            {deleteStatus.message}
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden email-list-scroll"
        ref={emailListRef}
        style={{ height: "calc(100% - 120px)" }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={() => onRefresh()}
              className="mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-base"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/20">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/60 text-lg">
                  {activeTagFilter
                    ? `No emails found with tag "${activeTagFilter}"`
                    : "No emails found"}
                </p>
              </div>
            ) : (
              filteredThreads.map(({ threadId, latestEmail, count }) => {
                // Check if email is starred (either from API or local state)
                const isStarred = starredEmails.has(latestEmail.id);
                const isDeleting = deletingEmails.has(latestEmail.id);

                return (
                  <div
                    key={threadId}
                    className={`p-5 hover:bg-white/10 cursor-pointer transition-all duration-300 email-item ${
                      selectedEmailId === latestEmail.id
                        ? "bg-white/20 transform scale-[1.03] -translate-y-1 z-10 shadow-[0_0_15px_rgba(255,255,255,0.2)] selected-email-glow"
                        : ""
                    } ${isDeleting ? "deleting-email" : "opacity-100"}`}
                    onClick={() => onSelectEmail(latestEmail)}
                  >
                    <div
                      className={`${
                        selectedEmailId === latestEmail.id ? "p-1" : ""
                      } transition-all duration-300`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium truncate pr-3 text-lg">
                          {getEmailSubject(latestEmail)}
                        </h3>
                        <div className="flex items-center gap-2">
                          {/* Star button */}
                          <button
                            className="text-white/40 hover:text-yellow-400 transition-colors"
                            onClick={(e) => handleToggleStar(latestEmail, e)}
                            aria-label={
                              isStarred ? "Unstar email" : "Star email"
                            }
                          >
                            {isStarred ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-6 h-6 text-yellow-400"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-6 h-6"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-white/80 mb-2 truncate">
                        From: {getEmailSender(latestEmail)}
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-sm text-white/60">
                          {formatDate(latestEmail.internalDate)}
                        </div>

                        {/* Delete button */}
                        {checkEmailAPIAvailable() && (
                          <button
                            className="text-white/40 hover:text-red-400 transition-colors"
                            onClick={(e) => handleDeleteEmail(latestEmail, e)}
                            aria-label="Delete email"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailList;
