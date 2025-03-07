// main.ts
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { EmailService } from "../src/services/api/email-service";
import { registerGmailHandlers } from "../src/services/ipcMain/gmail";
import { initDb } from "./database";
import { authenticate, SCOPES } from "./auth/google-auth";
import { store } from "./store";

// Import our ServerManager
const ServerManager = require("../../server/server_manager");
const serverManager = new ServerManager();

// Load environment variables from .env file
dotenv.config();

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
    icon: path.join(__dirname, "../../public/app-icons/rift-icons.png"), // App icon for taskbar/dock
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
 * Creates an EmailService instance with the authenticated client
 * @returns {Promise<EmailService>} Initialized EmailService
 */
export async function createEmailService(): Promise<EmailService> {
  const auth = await authenticate(mainWindow);
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

  // Set the dock icon for macOS
  if (process.platform === "darwin") {
    app.dock.setIcon(
      path.join(__dirname, "../../public/app-icons/rift-icons.png")
    );
  }

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
