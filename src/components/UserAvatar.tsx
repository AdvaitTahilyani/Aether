import { useState, useRef, useEffect } from "react";

interface UserAvatarProps {
  userEmail: string;
  onLogout: () => void;
}

function UserAvatar({ userEmail, onLogout }: UserAvatarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the first letter of the email
  const firstLetter = userEmail.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
        aria-label="User menu"
      >
        <span className="text-xl font-medium">{firstLetter}</span>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-3 w-56 bg-indigo-900 rounded-lg shadow-xl border border-white/20 overflow-hidden z-50 animate-fadeIn">
          <div className="p-4 border-b border-white/20">
            <p className="font-medium text-base truncate">{userEmail}</p>
            <p className="text-sm text-white/60 mt-1">Aether Mail</p>
          </div>
          <button
            onClick={() => {
              setShowDropdown(false);
              onLogout();
            }}
            className="w-full p-4 text-left hover:bg-indigo-800 transition-colors flex items-center gap-3 text-base"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zm7 5a1 1 0 10-2 0v4.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 12.586V8z"
                clipRule="evenodd"
              />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default UserAvatar;
