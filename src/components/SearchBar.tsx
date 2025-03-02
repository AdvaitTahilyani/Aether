import React, { useState, useEffect } from "react";
import { isElectronAPIAvailable } from "../services";

interface Email {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  date: Date;
  isUnread: boolean;
}

interface SearchBarProps {
  onSearchResults: (results: Email[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearchResults }) => {
  const [query, setQuery] = useState<string>("");
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [apiAvailable, setApiAvailable] = useState<boolean>(false);

  // Check if the Electron API is available when the component mounts
  useEffect(() => {
    const checkAPI = () => {
      const available =
        isElectronAPIAvailable() && !!window.electronAPI?.searchEmails;
      setApiAvailable(available);

      if (!available) {
        console.log("Search API not available yet, will retry...");
        // Retry after a short delay
        setTimeout(checkAPI, 1000);
      } else {
        console.log("Search API is available");
      }
    };

    checkAPI();
  }, []);

  const handleSearch = async () => {
    if (!query && !filter) return;

    setLoading(true);
    setError("");
    try {
      // Combine filter and query into a Gmail query string
      const finalQuery = `${filter} ${query}`.trim();

      // Check if the API is available
      if (!isElectronAPIAvailable()) {
        throw new Error("Electron API not available");
      }

      // Call the searchEmails method exposed via electronAPI
      if (!window.electronAPI?.searchEmails) {
        throw new Error("Search functionality not available");
      }

      const searchResults = await window.electronAPI.searchEmails(finalQuery);
      onSearchResults(searchResults);
    } catch (err) {
      console.error("Error searching emails:", err);
      setError("Error searching emails");
      onSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl">
      <div className="flex flex-row gap-2 w-full">
        <input
          type="text"
          placeholder="Search emails..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow p-2 border border-white/30 bg-white/10 rounded-md focus:outline-none focus:ring focus:ring-blue-500 text-white"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border border-white/30 bg-white/10 rounded-md focus:outline-none focus:ring focus:ring-blue-500 text-white"
        >
          <option value="">All</option>
          <option value="is:unread">Unread</option>
          <option value="has:attachment">Has Attachment</option>
          <option value="in:inbox">Inbox</option>
          <option value="in:sent">Sent</option>
          <option value="is:starred">Starred</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={loading || !apiAvailable}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {error && <div className="text-red-500 mt-1">{error}</div>}
      {!apiAvailable && !error && (
        <div className="text-yellow-500 mt-1">
          Search functionality is initializing...
        </div>
      )}
    </div>
  );
};

export default SearchBar;
