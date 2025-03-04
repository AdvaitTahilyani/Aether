import { useState, useEffect, useRef } from "react";
import { EmailDetails } from "../types";
import { createFallbackEmail, isElectronAPIAvailable } from "../services";
import EmailList from "../components/EmailList";
import EmailViewer from "../components/EmailViewer";
import UserAvatar from "../components/UserAvatar";
import ComposeEmail from "../components/ComposeEmail";
import Sidebar, { EmailCategory } from "../components/Sidebar";
import SearchBar from "../components/SearchBar";

interface EmailDashboardProps {
  userEmail: string;
  onLogout: () => void;
}

function EmailDashboard({ userEmail, onLogout }: EmailDashboardProps) {
  const [emails, setEmails] = useState<EmailDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetails | null>(null);
  const [permissionError, setPermissionError] = useState<boolean>(false);
  const [showComposeEmail, setShowComposeEmail] = useState<boolean>(false);
  const [currentCategory, setCurrentCategory] =
    useState<EmailCategory>("inbox");
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<EmailDetails[]>([]);
  const [columnWidth, setColumnWidth] = useState<number>(33); // Default to 33% width

  const resizingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(33);

  // Function to fetch emails based on the current category
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setPermissionError(false);

      if (!isElectronAPIAvailable()) {
        throw new Error("Electron API not available");
      }

      // Create a query based on the current category
      let query: string | undefined;
      switch (currentCategory) {
        case "inbox":
          query = "in:inbox";
          break;
        case "starred":
          query = "is:starred";
          break;
        case "sent":
          query = "in:sent";
          break;
        case "spam":
          query = "in:spam";
          break;
        case "trash":
          query = "in:trash";
          break;
      }

      // Get list of email IDs with the appropriate query
      const emailList = await window.electronAPI!.getEmails(50, query); // Request up to 50 emails

      if (!emailList || emailList.length === 0) {
        setEmails([]);
        setLoading(false);
        return;
      }

      // Check if getEmailDetails is available
      if (typeof window.electronAPI!.getEmailDetails !== "function") {
        console.warn("getEmailDetails method is not available");
        // Just use the basic email list with fallback details
        setEmails(emailList.map((email) => createFallbackEmail(email)));
        setLoading(false);
        return;
      }

      // Fetch details for each email (fetch at least 25 for better user experience)
      const emailsToFetch = emailList.slice(0, 25);
      const emailDetailsPromises = emailsToFetch.map(async (email) => {
        try {
          return await window.electronAPI!.getEmailDetails(email.id);
        } catch (err) {
          console.error(`Error fetching details for email ${email.id}:`, err);
          // Return a fallback object if details fetch fails
          return createFallbackEmail(email);
        }
      });

      // Wait for all email details to be fetched
      const emailDetails = await Promise.all(emailDetailsPromises);
      console.log(`Fetched ${currentCategory} email details:`, emailDetails);

      setEmails(emailDetails as EmailDetails[]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch emails";
      setError(errorMessage);
      console.error(`Error fetching ${currentCategory} emails:`, errorMessage);

      // Check if this is a permission error
      if (errorMessage.includes("Insufficient Permission")) {
        setPermissionError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch emails when the component mounts or category changes
  useEffect(() => {
    fetchEmails();
    // Clear selected email when changing categories
    setSelectedEmail(null);
  }, [currentCategory]);

  // Handle refreshing the email list
  const handleRefresh = () => {
    // If a deleted email was selected, clear the selection
    if (
      selectedEmail &&
      !emails.some((email) => email.id === selectedEmail.id)
    ) {
      setSelectedEmail(null);
    }

    // Fetch emails again
    fetchEmails();
  };

  // Handle selecting or deselecting an email
  const handleSelectEmail = (email: EmailDetails) => {
    // If the clicked email is already selected, deselect it
    if (selectedEmail && selectedEmail.id === email.id) {
      setSelectedEmail(null);
    } else {
      // Otherwise, select the clicked email
      setSelectedEmail(email);
    }
  };

  // Handle clearing the selected email (used after sending a reply)
  const handleClearSelection = () => {
    setSelectedEmail(null);
  };

  // Handle permission errors
  const handlePermissionError = () => {
    setPermissionError(true);
  };

  // Handle compose email button click
  const handleComposeEmail = () => {
    setShowComposeEmail(true);
  };

  // Handle closing the compose email modal
  const handleCloseComposeEmail = () => {
    setShowComposeEmail(false);
  };

  // Handle email sent successfully
  const handleEmailSent = () => {
    // Refresh the email list to include the newly sent email
    fetchEmails();
  };

  // Handle category change from sidebar
  const handleCategoryChange = (category: EmailCategory) => {
    setCurrentCategory(category);
  };

  const handleSearchResults = (results: any[]) => {
    if (!results || results.length === 0) {
      setSearchResults([]);
      setIsSearchMode(true);
      setSelectedEmail(null);
      return;
    }

    console.log("Search results:", results);

    // Convert search results to EmailDetails format
    const formattedResults = results.map((result) => {
      // Create a properly formatted EmailDetails object
      return {
        id: result.id,
        threadId: result.id, // Use ID as thread ID if not provided
        labelIds: [],
        snippet: result.snippet || "",
        payload: {
          headers: [
            { name: "From", value: result.from || "Unknown Sender" },
            { name: "Subject", value: result.subject || "No Subject" },
            {
              name: "Date",
              value: result.date
                ? result.date.toString()
                : new Date().toString(),
            },
          ],
          mimeType: "text/plain",
          body: {
            data: btoa(unescape(encodeURIComponent(result.snippet || ""))),
            size: (result.snippet || "").length,
          },
        },
        historyId: "0",
        internalDate: result.date
          ? result.date.getTime().toString()
          : new Date().getTime().toString(),
        sizeEstimate: 0,
      };
    });

    console.log("Formatted search results:", formattedResults);

    setSearchResults(formattedResults);
    setIsSearchMode(true);

    // If we have results, select the first one
    if (formattedResults.length > 0) {
      setSelectedEmail(formattedResults[0]);
    } else {
      setSelectedEmail(null);
    }
  };

  const handleClearSearch = () => {
    setIsSearchMode(false);
    setSearchResults([]);
    // Reselect an email from the regular list if available
    if (emails.length > 0) {
      setSelectedEmail(emails[0]);
    } else {
      setSelectedEmail(null);
    }
  };

  // Handle resizing of the email list column
  const handleResizeStart = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidth;
    document.body.style.cursor = "col-resize";

    // Add event listeners for mouse move and mouse up
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;

    const containerWidth =
      document.querySelector(".flex-1.flex")?.clientWidth || 1000;
    const deltaX = e.clientX - startXRef.current;
    const deltaPercent = (deltaX / containerWidth) * 100;

    // Calculate new width percentage (constrain between 20% and 60%)
    const newWidth = Math.min(
      Math.max(startWidthRef.current + deltaPercent, 20),
      60
    );
    setColumnWidth(newWidth);
  };

  const handleResizeEnd = () => {
    resizingRef.current = false;
    document.body.style.cursor = "default";

    // Remove event listeners
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0A] text-white overflow-hidden">
      {/* Header with app title, search bar, and user avatar */}
      <header className="bg-white/10 backdrop-blur-lg p-6 border-b border-white/30 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Aether Mail</h1>
        </div>
        <div className="flex-grow flex justify-center">
          <SearchBar onSearchResults={handleSearchResults} />
        </div>
        <UserAvatar userEmail={userEmail} onLogout={onLogout} />
      </header>

      {/* Permission error notification */}
      {permissionError && (
        <div className="bg-red-500/20 text-red-300 p-4 text-center">
          <p className="font-medium">
            Insufficient permissions to perform some actions. Please{" "}
            <button
              onClick={onLogout}
              className="underline font-bold hover:text-red-200"
            >
              log out
            </button>{" "}
            and log in again to grant the necessary permissions.
          </p>
        </div>
      )}

      {/* Search mode indicator */}
      {isSearchMode && (
        <div className="bg-blue-500/20 text-blue-300 p-2 text-center flex justify-between items-center">
          <div className="flex-1"></div>
          <p className="font-medium flex-1">
            Showing search results ({searchResults.length})
          </p>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClearSearch}
              className="text-sm underline hover:text-blue-200"
            >
              Clear search
            </button>
          </div>
        </div>
      )}

      {/* Main content - Three column layout with sidebar */}
      <div className="flex flex-1 overflow-hidden min-h-screen">
        {/* Sidebar */}
        <Sidebar
          currentCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          onComposeClick={handleComposeEmail}
        />

        {/* Email list column with resizable width */}
        <div
          className="border-r border-white/30 overflow-auto relative"
          style={{
            width: `${columnWidth}%`,
            minHeight: "calc(100vh - 120px)",
          }}
        >
          <EmailList
            emails={isSearchMode ? searchResults : emails}
            loading={loading && !isSearchMode}
            error={error}
            onSelectEmail={handleSelectEmail}
            selectedEmailId={selectedEmail?.id || null}
            onRefresh={isSearchMode ? handleClearSearch : handleRefresh}
            onPermissionError={handlePermissionError}
            category={currentCategory}
          />

          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full bg-white/10 hover:bg-white/30 cursor-col-resize transition-colors"
            onMouseDown={handleResizeStart}
          />
        </div>

        {/* Email Viewer */}
        <div
          className="h-full overflow-hidden"
          style={{ width: `${100 - columnWidth}%` }}
        >
          {selectedEmail ? (
            <EmailViewer
              selectedEmail={selectedEmail}
              userEmail={userEmail}
              onClearSelection={handleClearSelection}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]">
              <p className="text-gray-500 dark:text-gray-400">
                Select an email to view
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {showComposeEmail && (
        <ComposeEmail
          userEmail={userEmail}
          onClose={handleCloseComposeEmail}
          onSent={handleEmailSent}
        />
      )}
    </div>
  );
}

export default EmailDashboard;
