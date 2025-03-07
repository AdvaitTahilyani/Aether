import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import http from "http";
import url from "url";
import { BrowserWindow, shell } from "electron";
import { findAvailablePort } from "../utils/network";
import { getAuthSuccessPage } from "../auth-success-page";
import { store } from "../store";

// Define Gmail API scopes (permissions we need from the user)
// VERY BROAD SCOPES - FOR TESTING ONLY.  Reduce to minimum required scopes after testing.
export const SCOPES = [
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

/**
 * Loads OAuth client secrets from environment variables (.env file).
 * Ensures credentials are not hard-coded or stored in a JSON file.
 * @returns {{ client_id: string; client_secret: string; redirect_uris: string[] }}
 */
export function loadClientSecrets(): {
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
 */
export async function authenticate(
  mainWindow: BrowserWindow | null
): Promise<OAuth2Client> {
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
        return getNewToken(mainWindow);
      }
    }
    return oAuth2Client;
  }

  // No tokens found, get new ones
  console.log("No tokens found, starting new authentication flow");
  return getNewToken(mainWindow);
}

/**
 * Obtains a new OAuth token by prompting the user to log in via their browser.
 * Sets up a local server to capture the authorization code and exchange it for tokens.
 * Uses a dynamic port to avoid conflicts with other services.
 * @returns {Promise<OAuth2Client>} The authenticated client with new tokens
 */
async function getNewToken(
  mainWindow: BrowserWindow | null
): Promise<OAuth2Client> {
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

  // Notify the user in the main window
  if (mainWindow) {
    mainWindow.webContents.send(
      "auth-started",
      "Authentication started in your default browser"
    );
  }

  // Open the authentication URL in the user's default browser
  shell.openExternal(authUrl);

  // Return a promise that resolves when the token is obtained
  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        if (req.url?.startsWith("/oauth2callback")) {
          const qs = new url.URL(req.url, `http://localhost:${port}`)
            .searchParams;
          const code = qs.get("code");

          // Send a more user-friendly success page
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(getAuthSuccessPage());

          server.close();

          if (code) {
            try {
              const { tokens } = await updatedOAuth2Client.getToken(code);
              updatedOAuth2Client.setCredentials(tokens);
              // Store tokens securely using electron-store
              store.set("googleToken", tokens);

              // Notify the main window that authentication is complete
              if (mainWindow) {
                mainWindow.webContents.send(
                  "auth-complete",
                  "Authentication successful"
                );
                // Focus the main window to bring it to the front
                mainWindow.focus();
              }

              resolve(updatedOAuth2Client);
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              // Notify the main window about the error
              if (mainWindow) {
                mainWindow.webContents.send(
                  "auth-error",
                  `Authentication failed: ${errorMessage}`
                );
              }

              reject(new Error(`Token exchange failed: ${errorMessage}`));
            }
          } else {
            // Notify the main window about the error
            if (mainWindow) {
              mainWindow.webContents.send(
                "auth-error",
                "No authorization code received"
              );
            }

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

        // Notify the main window about the timeout
        if (mainWindow) {
          mainWindow.webContents.send(
            "auth-error",
            "Authentication timed out after 5 minutes"
          );
        }

        reject(new Error("Authentication timed out after 5 minutes"));
      } catch {
        // Server might already be closed, ignore any errors
      }
    }, 5 * 60 * 1000); // 5 minutes timeout
  });
}
