// src/App.tsx
import "./index.css";
import "./transitions.css"; // Make sure this file exists
import "./email.css"; // Import email-specific styles
import { useState, useEffect } from "react";
import EmailDashboard from "./pages/EmailDashboard";
import {
  isElectronAPIAvailable,
  validateElectronAPI,
} from "./services/electronService";

function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true
  const [apiAvailable, setApiAvailable] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  // Check if Electron API is available and check auth status on component mount
  useEffect(() => {
    const checkApiAndAuth = async () => {
      if (isElectronAPIAvailable()) {
        const isValid = validateElectronAPI();
        setApiAvailable(isValid);

        if (isValid) {
          try {
            const result = await window.electronAPI!.ping();
            setPingResult(result);

            // Check if user is already authenticated
            const userEmail = await window.electronAPI!.checkAuthStatus();
            if (userEmail) {
              setEmail(userEmail);
            }
          } catch (err) {
            console.error("API error:", err);
          } finally {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } else {
        setApiAvailable(false);
        setIsLoading(false);
      }
    };

    checkApiAndAuth();
  }, []);

  // Handle the Google login process
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isElectronAPIAvailable()) {
        throw new Error(
          "Electron API not available. Are you running in browser mode?"
        );
      }

      const userEmail = await window.electronAPI!.loginWithGoogle();
      setEmail(userEmail);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Login failed:", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (isElectronAPIAvailable()) {
        await window.electronAPI!.logout();
      }
      setEmail(null);
    } catch (err) {
      console.error("Error during logout:", err);
      setEmail(null);
    }
  };

  // If user is logged in, show the dashboard
  if (email) {
    return <EmailDashboard userEmail={email} onLogout={handleLogout} />;
  }

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="app-container flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Otherwise, show the login screen
  return (
    <>
      {/* Add this invisible draggable region */}
      <div className="titlebar-drag-region"></div>

      <div className="app-container flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white p-8">
        <div className="max-w-lg w-full bg-white/10 backdrop-blur-lg rounded-2xl p-10 shadow-2xl border border-white/20">
          <div className="text-center">
            {/* Logo/Icon */}
            <div className="mx-auto w-28 h-28 bg-white/20 rounded-full flex items-center justify-center mb-8">
              <img
                src="/icons/mail-icon.svg"
                alt="Mail Icon"
                className="w-14 h-14"
              />
            </div>

            <h1 className="text-5xl font-bold mb-3 tracking-tight">
              Welcome to Aether
            </h1>

            <p className="text-2xl text-white/80 mb-10">
              Your personal AI mail + assistant
            </p>

            {/* API Status Indicator */}
            <div className="mb-6 text-base">
              <span
                className={`inline-block w-4 h-4 rounded-full mr-2 ${
                  apiAvailable ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              Electron API: {apiAvailable ? "Available" : "Not Available"}
              {pingResult && (
                <div className="mt-2">Ping test: {pingResult}</div>
              )}
            </div>

            {/* Login button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || !apiAvailable}
              className="w-full py-4 px-8 bg-white text-indigo-900 rounded-lg text-lg font-medium flex items-center justify-center gap-3 hover:bg-white/90 transition-colors duration-300 shadow-lg no-drag disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="animate-pulse">Connecting...</span>
              ) : (
                <>
                  <img
                    src="/icons/google-icon.svg"
                    alt="Google Icon"
                    className="w-6 h-6"
                  />
                  Login with Google
                </>
              )}
            </button>

            {/* Display error message if login fails */}
            {error && <p className="mt-6 text-red-400 text-base">{error}</p>}

            <p className="mt-8 text-base text-white/60">
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
