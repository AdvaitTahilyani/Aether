// src/App.tsx
import "./index.css";
import "./draggable.css"; // Make sure this file exists
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
    console.log("Window object:", window);
    console.log("electronAPI available:", isElectronAPIAvailable());

    // List all properties of window for debugging
    console.log("Window properties:", Object.keys(window));

    const checkApiAndAuth = async () => {
      if (isElectronAPIAvailable()) {
        const isValid = validateElectronAPI();
        setApiAvailable(isValid);

        if (isValid) {
          // Test the ping method
          try {
            const result = await window.electronAPI!.ping();
            console.log("Ping result:", result);
            setPingResult(result);

            // Check if user is already authenticated
            const userEmail = await window.electronAPI!.checkAuthStatus();
            if (userEmail) {
              console.log("User already authenticated:", userEmail);
              setEmail(userEmail);
            }
          } catch (err) {
            console.error("API error:", err);
          } finally {
            setIsLoading(false);
          }
        } else {
          console.warn("Electron API validation failed");
          setIsLoading(false);
        }
      } else {
        console.warn("Electron API not available. Running in browser mode?");
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
      console.log("Logging in with Google...");

      // Check if electronAPI is available
      if (!isElectronAPIAvailable()) {
        throw new Error(
          "Electron API not available. Are you running in browser mode?"
        );
      }

      const userEmail = await window.electronAPI!.loginWithGoogle();
      setEmail(userEmail);
      console.log("Successfully logged in as:", userEmail);
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
        console.log("Logged out successfully");
      }
      setEmail(null);
    } catch (err) {
      console.error("Error during logout:", err);
      // Still clear the email state even if the API call fails
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-14 h-14"
              >
                <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
              </svg>
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-6 h-6"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                    <path fill="none" d="M1 1h22v22H1z" />
                  </svg>
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
