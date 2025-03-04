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
import { useEmailStore } from "../store/email";
import {
  RefreshIcon,
  StarFilledIcon,
  StarOutlineIcon,
  TrashIcon,
} from "./icons";

interface EmailListProps {
  emails: EmailDetails[];
  loading: boolean;
  error: string | null;
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
  onRefresh,
  onPermissionError,
  category = "inbox", // Default to inbox
}) => {
  const { currentSelectedEmail, setCurrentSelectedEmail } = useEmailStore();
  // Debug: Log emails when they change

  const handleSelectEmail = (email: EmailDetails) => {
    if (currentSelectedEmail && currentSelectedEmail.id === email.id) {
      setCurrentSelectedEmail(null);
    } else {
      setCurrentSelectedEmail(email);
    }
  };
  useEffect(() => {
    console.log(`EmailList received ${category} emails:`, emails);
    if (emails.length > 0) {
      // Log the structure of the first email for debugging

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
      if (filteredThreads.length === 0 || !currentSelectedEmail) return;

      // Find the index of the currently selected email
      const currentIndex = filteredThreads.findIndex(
        ({ latestEmail }) => latestEmail.id === currentSelectedEmail.id
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
        handleSelectEmail(newEmail);

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
  }, [filteredThreads, currentSelectedEmail, handleSelectEmail]);

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
            <RefreshIcon />
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
                      currentSelectedEmail?.id === latestEmail.id
                        ? "bg-white/20 transform scale-[1.03] -translate-y-1 z-10 shadow-[0_0_15px_rgba(255,255,255,0.2)] selected-email-glow"
                        : ""
                    } ${isDeleting ? "deleting-email" : "opacity-100"}`}
                    onClick={() => handleSelectEmail(latestEmail)}
                  >
                    <div
                      className={`${
                        currentSelectedEmail?.id === latestEmail.id ? "p-1" : ""
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
                              <StarFilledIcon className="w-6 h-6 text-yellow-400" />
                            ) : (
                              <StarOutlineIcon />
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
                            <TrashIcon />
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
