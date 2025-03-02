/**
 * auth-service.ts
 *
 * Handles authentication with Google OAuth2, including token management and refresh.
 */

import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import http from "http";
import url from "url";
import ElectronStore from "electron-store";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize electron-store for secure, persistent token storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new ElectronStore() as any;

// Define Gmail API scopes (permissions we need from the user)
// VERY BROAD SCOPES - FOR TESTING ONLY. Reduce to minimum required scopes after testing.
const SCOPES = [
  "https://mail.google.com/", // Full access
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
];

// Reference to the main window for opening auth URLs
let mainWindow: Electron.BrowserWindow | null = null;

/**
 * Sets the main window reference for use in authentication flows
 * @param window - The main Electron BrowserWindow
 */
export function setMainWindow(window: Electron.BrowserWindow): void {
  mainWindow = window;
}

/**
 * Loads OAuth client secrets from environment variables (.env file).
 * @returns {{ client_id: string; client_secret: string; redirect_uris: string[] }}
 */
function loadClientSecrets(): {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
} {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uris = [
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
  ];

  if (!client_id || !client_secret) {
    throw new Error(
      "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env file"
    );
  }

  return { client_id, client_secret, redirect_uris };
}

/**
 * Authenticates with Google using stored tokens or initiates a new OAuth flow.
 * Handles token refresh if existing tokens are expired.
 * @returns {Promise<OAuth2Client>} Authenticated OAuth2 client
 */
export async function authenticate(): Promise<OAuth2Client> {
  // Create OAuth client with credentials from environment variables
  const oAuth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/oauth2callback",
  });

  // Check if we have stored tokens
  const tokens = store.get("googleToken");
  if (tokens) {
    console.log("Using stored tokens");
    oAuth2Client.setCredentials(tokens);

    // Check if token is expired and needs refresh
    const expiryDate = tokens.expiry_date;
    const now = Date.now();
    if (expiryDate && now > expiryDate) {
      console.log("Token expired, refreshing...");
      try {
        const refreshedTokens = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(refreshedTokens.credentials);
        store.set("googleToken", refreshedTokens.credentials);
        console.log("Token refreshed successfully");
      } catch (error) {
        console.error("Error refreshing token:", error);
        // If refresh fails, clear tokens and get new ones
        store.delete("googleToken");
        return getNewToken();
      }
    }
    return oAuth2Client;
  }

  // No tokens found, get new ones
  console.log("No tokens found, starting new authentication flow");
  return getNewToken();
}

/**
 * Obtains a new OAuth token by prompting the user to log in via their browser.
 * @returns {Promise<OAuth2Client>} The authenticated client with new tokens
 */
async function getNewToken(): Promise<OAuth2Client> {
  // Try to find an available port starting from 3000
  const findAvailablePort = async (startPort: number): Promise<number> => {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.on("error", () => {
        // Port is in use, try the next one
        resolve(findAvailablePort(startPort + 1));
      });
      server.listen(startPort, () => {
        server.close(() => {
          resolve(startPort);
        });
      });
    });
  };

  const port = await findAvailablePort(3000);
  console.log(`Using port ${port} for OAuth callback server`);

  // Get the client secrets from the environment
  const { client_id, client_secret } = loadClientSecrets();

  // Update the redirect URI with the available port
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  // Create a new OAuth2Client with the updated redirect URI
  const updatedOAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const authUrl = updatedOAuth2Client.generateAuthUrl({
    access_type: "offline", // Ensures a refresh token is provided
    scope: SCOPES,
  });

  // Open the authentication URL in the user's default browser
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(
      `window.open('${authUrl}', '_blank')`
    );
  } else {
    console.error("Main window not available for opening auth URL");
    throw new Error("Application window not available");
  }

  // Return a promise that resolves when the token is obtained
  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        if (req.url?.startsWith("/oauth2callback")) {
          const qs = new url.URL(req.url, `http://localhost:${port}`)
            .searchParams;
          const code = qs.get("code");
          res.end("Authentication successful! You can close this window.");
          server.close();

          if (code) {
            try {
              const { tokens } = await updatedOAuth2Client.getToken(code);
              updatedOAuth2Client.setCredentials(tokens);
              // Store tokens securely using electron-store
              store.set("googleToken", tokens);
              resolve(updatedOAuth2Client);
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              reject(new Error(`Token exchange failed: ${errorMessage}`));
            }
          } else {
            reject(new Error("No authorization code received"));
          }
        }
      })
      .listen(port, (err?: Error) => {
        if (err) {
          console.error(`Server failed to start: ${err.message}`);
          reject(new Error(`Server failed to start: ${err.message}`));
        } else {
          console.log(`OAuth callback server listening on port ${port}`);
        }
      });

    // Add a timeout to prevent hanging if the user doesn't complete the auth flow
    setTimeout(() => {
      try {
        server.close();
        reject(new Error("Authentication timed out after 5 minutes"));
      } catch {
        // Server might already be closed, ignore any errors
      }
    }, 5 * 60 * 1000); // 5 minutes timeout
  });
}
