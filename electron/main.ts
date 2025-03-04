// main.ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import http from "http";
import url from "url";
import dotenv from "dotenv";
import fs from "fs";
import { EmailService } from "../src/services/api/email-service";
import { registerGmailHandlers } from "../src/services/ipcMain/gmail";
import { initDb } from "./database";
// Import our ServerManager
const ServerManager = require("../../server/server_manager");
const serverManager = new ServerManager();

// Load environment variables from .env file
dotenv.config();

// Define Gmail API scopes (permissions we need from the user)
// VERY BROAD SCOPES - FOR TESTING ONLY.  Reduce to minimum required scopes after testing.
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

// Simple storage implementation using a JSON file
class SimpleStore {
  private storePath: string;
  private data: Record<string, any> = {};

  constructor() {
    this.storePath = path.join(app.getPath("userData"), "store.json");
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.storePath)) {
        const fileContent = fs.readFileSync(this.storePath, "utf8");
        this.data = JSON.parse(fileContent);
        console.log("Store data loaded successfully");
      } else {
        console.log("No store file found, creating a new one");
        this.data = {};
        this.saveData();
      }
    } catch (error) {
      console.error("Error loading store data:", error);
      this.data = {};
    }
  }

  private saveData() {
    try {
      fs.writeFileSync(
        this.storePath,
        JSON.stringify(this.data, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Error saving store data:", error);
    }
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any) {
    this.data[key] = value;
    this.saveData();
  }

  delete(key: string) {
    delete this.data[key];
    this.saveData();
  }
}

// Initialize our simple store
export const store = new SimpleStore();

// Store the window reference globally to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

/**
 * Creates the main Electron window with custom styling and behavior.
 * Sets up a transparent, vibrant window with a hidden title bar for a macOS-native feel,
 * and loads the Vite-built React app.
 */
function createWindow() {
  // Log the current directory and environment
  console.log("Current directory:", __dirname);
  console.log("NODE_ENV:", process.env.NODE_ENV);

  // Determine the preload script path based on environment
  let preloadPath = path.join(__dirname, "preload.js");

  console.log("Initial preload script path:", preloadPath);

  // Check if the preload script exists
  if (!fs.existsSync(preloadPath)) {
    console.error(`Preload script not found at: ${preloadPath}`);
    // Try to find the preload script in alternative locations
    const altPaths = [
      path.join(__dirname, "../preload.js"),
      path.join(__dirname, "../../preload.js"),
      path.join(__dirname, "../electron/preload.js"),
    ];

    for (const altPath of altPaths) {
      console.log(`Checking for preload script at: ${altPath}`);
      if (fs.existsSync(altPath)) {
        console.log(`Found preload script at: ${altPath}`);
        preloadPath = altPath;
        break;
      }
    }
  } else {
    console.log(`Preload script found at: ${preloadPath}`);
  }

  // Create the browser window with specific dimensions and macOS-specific styles
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset", // Hides title bar but keeps traffic lights on macOS
    transparent: true, // Enables transparency for custom UI effects
    backgroundColor: "#00000000", // Fully transparent background
    vibrancy: "under-window", // macOS vibrancy effect for a blurred background
    webPreferences: {
      nodeIntegration: false, // Secure: Disable Node.js in renderer
      contextIsolation: true, // Secure: Enable context isolation
      preload: preloadPath,
      enableBlinkFeatures: "CSSOMSmoothScroll", // Enable smooth scrolling in Chromium
    },
  });

  // Load the app based on environment
  const url =
    process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER_URL
      ? process.env.VITE_DEV_SERVER_URL
      : `file://${path.join(__dirname, "../../dist/index.html")}`;

  mainWindow.loadURL(url);

  // Inject CSS for smooth transitions after page load
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.insertCSS(`
      html, body {
        transition: all 0.3s ease-in-out !important; /* Smooth transitions for fullscreen, etc. */
      }
      
      #root, .app-container {
        transition: all 0.3s ease-in-out !important; /* Smooth transitions for React root */
      }
    `);
  });

  // Handle window close event to clean up reference
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open DevTools in development for debugging
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // Start the Flask server
  serverManager
    .startServer()
    .then((serverUrl: string) => {
      console.log(`Flask server started at ${serverUrl}`);
    })
    .catch((error: Error) => {
      console.error("Failed to start Flask server:", error);
    });
}

/**
 * Loads OAuth client secrets from environment variables (.env file).
 * Ensures credentials are not hard-coded or stored in a JSON file.
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
 * Sets up a local server to capture the authorization code and exchange it for tokens.
 * Uses a dynamic port to avoid conflicts with other services.
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
  mainWindow?.webContents.executeJavaScript(
    `window.open('${authUrl}', '_blank')`
  );

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

/**
 * Creates an EmailService instance with the authenticated client
 * @returns {Promise<EmailService>} Initialized EmailService
 */
export async function createEmailService(): Promise<EmailService> {
  const auth = await authenticate();
  return new EmailService(auth);
}

/**
 * IPC handler to check if the user is already authenticated.
 * Returns the user's email if authenticated, null otherwise.
 */
ipcMain.handle("check-auth-status", async () => {
  try {
    // Check if we have stored tokens
    const tokens = store.get("googleToken");
    if (!tokens) {
      console.log("No stored tokens found");
      return null;
    }

    // Try to use the tokens to get user profile
    const emailService = await createEmailService();
    const email = await emailService.getUserEmail();
    console.log("User is already authenticated:", email);
    return email;
  } catch (error: unknown) {
    console.error("Error checking auth status:", error);
    // If there's an error (e.g., invalid/expired token), clear tokens
    if (store) store.delete("googleToken");
    return null;
  }
});

ipcMain.handle("store-get", async (_, key: string) => {
  return store.get(key) ?? ""; // Return value or null if not found
});

// ✅ IPC Handler to SET a value by key
ipcMain.handle("store-set", async (_, key: string, value: any) => {
  store.set(key, value);
  return true; // Indicate success
});

/**
 * IPC handler to log out the user by clearing stored tokens.
 */
ipcMain.handle("logout", async () => {
  try {
    store.delete("googleToken");
    console.log("User logged out, tokens cleared");
    return true;
  } catch (error: unknown) {
    console.error("Error during logout:", error);
    return false;
  }
});

// Add IPC handlers for the Flask server
ipcMain.handle("llama:server-status", async () => {
  return serverManager.isServerRunning();
});

ipcMain.handle("llama:server-url", () => {
  return serverManager.getServerUrl();
});

ipcMain.handle("llama:server-logs", () => {
  const logPath = serverManager.getLogPath();
  try {
    return fs.readFileSync(logPath, "utf8");
  } catch (error) {
    console.error("Error reading server logs:", error);
    return "Error reading server logs";
  }
});

// Create window when app is ready
app.whenReady().then(() => {
  initDb();

  // Register IPC handlers
  registerGmailHandlers();

  // Create window and other setup
  createWindow();

  // On macOS, re-create window when dock icon is clicked if no windows exist
  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Stop the Flask server before quitting
    serverManager
      .stopServer()
      .then(() => {
        app.quit();
      })
      .catch((error: Error) => {
        console.error("Error stopping Flask server:", error);
        app.quit();
      });
  }
});

// Handle any uncaught exceptions to prevent app crashes
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
