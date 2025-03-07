import "./index.css";
import "./transitions.css";
import "./email.css";
import { useState, useEffect } from "react";
import EmailDashboard from "./pages/EmailDashboard";
import {
  isElectronAPIAvailable,
  validateElectronAPI,
} from "./services/electronService";
import { useEmailStore } from "./store/email";
function App() {
  const { userEmail, setUserEmail } = useEmailStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiAvailable, setApiAvailable] = useState<boolean>(false);

  // Check if Electron API is available and check auth status on component mount
  useEffect(() => {
    const checkApiAndAuth = async () => {
      if (isElectronAPIAvailable()) {
        const isValid = validateElectronAPI();
        setApiAvailable(isValid);

        if (isValid) {
          try {
            // Check if user is already authenticated
            const userEmail = await window.electronAPI!.checkAuthStatus();
            if (userEmail) {
              setUserEmail(userEmail);
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
      setUserEmail(userEmail);
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
      setUserEmail(null);
    } catch (err) {
      console.error("Error during logout:", err);
      setUserEmail(null);
    }
  };

  // If user is logged in, show the dashboard
  if (userEmail) {
    return <EmailDashboard onLogout={handleLogout} />;
  }

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="app-container flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Otherwise, show the login screen
  return (
    <>
      <div className="app-container flex items-center justify-center min-h-screen bg-[#0A0A0A] text-white p-8">
        <div className="max-w-lg w-full bg-white/10 backdrop-blur-lg rounded-2xl p-10 shadow-2xl border border-white/20">
          <div className="text-center">
            {/* Logo/Icon */}
            <div className="mx-auto w-28 h-28 bg-white/20 rounded-full flex items-center justify-center mb-8">
              <img
                src="/rift.svg"
                alt="Rift Logo"
                className="w-16 h-16 rounded-full"
              />
            </div>

            <h1 className="text-4xl font-bold mb-4">Welcome to Rift</h1>

            <p className="text-lg mb-8">Your intelligent email assistant</p>

            {/* Login button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || !apiAvailable}
              className="w-full py-4 px-8 bg-white text-indigo-900 rounded-lg text-lg font-medium flex items-center justify-center gap-3 hover:bg-white/90 transition-colors duration-300 shadow-lg no-drag disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src="/icons/google-icon.svg"
                alt="Google Icon"
                className="w-6 h-6"
              />
              Login with Google
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
