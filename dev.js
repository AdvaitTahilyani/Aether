// dev.js - Development script to run the app
const { spawn } = require("child_process");
const { createServer } = require("vite");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Create preload.js in the root directory
console.log("Ensuring preload.js exists in the root directory...");
const rootPreloadPath = path.join(__dirname, "preload.js");
const preloadContent = `
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script is running!");

// Check if contextBridge is available
if (!contextBridge) {
  console.error("contextBridge is not available!");
} else {
  console.log("contextBridge is available, exposing electronAPI...");
  
  try {
    // Expose protected methods that allow the renderer process to use
    // the ipcRenderer without exposing the entire object
    contextBridge.exposeInMainWorld("electronAPI", {
      loginWithGoogle: () => ipcRenderer.invoke("login-with-google"),
      getEmails: (maxResults) => ipcRenderer.invoke("get-emails", maxResults),
      getEmailDetails: (emailId) => ipcRenderer.invoke("get-email-details", emailId),
      getThreadEmails: (threadId, maxResults) => ipcRenderer.invoke("get-thread-emails", threadId, maxResults),
      checkAuthStatus: () => ipcRenderer.invoke("check-auth-status"),
      logout: () => ipcRenderer.invoke("logout"),
      deleteEmail: (emailId) => ipcRenderer.invoke("delete-email", emailId),
      markEmailAsRead: (emailId) => ipcRenderer.invoke("mark-email-as-read", emailId),
      // Add a simple test method that doesn't require authentication
      ping: () => Promise.resolve("pong"),
    });
    
    console.log("electronAPI has been exposed to the renderer process");
  } catch (error) {
    console.error("Error exposing electronAPI:", error);
  }
}

// Add a global variable to check in the renderer
if (typeof window !== 'undefined') {
  console.log("Window object is available in preload");
}
`;

fs.writeFileSync(rootPreloadPath, preloadContent);
console.log(`Created/updated preload.js at: ${rootPreloadPath}`);

// Also ensure the dist/electron directory exists and copy preload.js there
const distElectronDir = path.join(__dirname, "dist/electron");
if (!fs.existsSync(distElectronDir)) {
  fs.mkdirSync(distElectronDir, { recursive: true });
  console.log(`Created directory: ${distElectronDir}`);
}

const distPreloadPath = path.join(distElectronDir, "preload.js");
fs.writeFileSync(distPreloadPath, preloadContent);
console.log(`Created/updated preload.js at: ${distPreloadPath}`);

// Also ensure the dist directory exists and copy preload.js there
const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log(`Created directory: ${distDir}`);
}

const distRootPreloadPath = path.join(distDir, "preload.js");
fs.writeFileSync(distRootPreloadPath, preloadContent);
console.log(`Created/updated preload.js at: ${distRootPreloadPath}`);

// Ensure the dist-electron directory exists
const distElectronDirNew = path.join(__dirname, "dist-electron/electron");
if (!fs.existsSync(distElectronDirNew)) {
  fs.mkdirSync(distElectronDirNew, { recursive: true });
}

// Copy preload.js to dist-electron
console.log("Copying preload.js to dist-electron...");
const sourcePreloadPath = path.join(__dirname, "electron/preload.js");
const destPreloadPath = path.join(
  __dirname,
  "dist-electron/electron/preload.js"
);

if (fs.existsSync(sourcePreloadPath)) {
  fs.copyFileSync(sourcePreloadPath, destPreloadPath);
  console.log("Preload script copied successfully!");
} else {
  console.error("Source preload.js not found!");
  process.exit(1);
}

// Compile main process TypeScript
console.log("Compiling main process TypeScript...");
try {
  execSync("tsc -p tsconfig.electron.json", { stdio: "inherit" });
  console.log("Main process TypeScript compiled successfully!");
} catch (error) {
  console.error("Error compiling main process TypeScript:", error);
  process.exit(1);
}

async function startApp() {
  console.log("Starting Vite dev server...");

  // Start Vite dev server
  const viteServer = await createServer({
    configFile: path.resolve(__dirname, "vite.config.ts"),
    mode: "development",
  });

  await viteServer.listen();
  const vitePort = viteServer.config.server.port || 5173;

  console.log(`Vite dev server running at http://localhost:${vitePort}`);

  // Set environment variables
  process.env.NODE_ENV = "development";
  process.env.VITE_DEV_SERVER_URL = `http://localhost:${vitePort}`;

  console.log("Environment variables set:");
  console.log("- NODE_ENV:", process.env.NODE_ENV);
  console.log("- VITE_DEV_SERVER_URL:", process.env.VITE_DEV_SERVER_URL);

  // Log the current directory structure
  console.log("Current directory:", __dirname);
  console.log("Root preload script path:", rootPreloadPath);
  console.log("Dist preload script path:", distPreloadPath);
  console.log("Dist root preload script path:", distRootPreloadPath);

  // Start Electron app with debugging
  console.log("Starting Electron app...");
  const electronProcess = spawn(electron, ["--inspect=5858", "."], {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: "true",
      ELECTRON_ENABLE_STACK_DUMPING: "true",
    },
  });

  electronProcess.on("close", (code) => {
    console.log(`Electron process exited with code ${code}`);
    viteServer.close();
    process.exit(code || 0);
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down...");
    electronProcess.kill();
    viteServer.close();
    process.exit(0);
  });
}

startApp().catch((err) => {
  console.error("Error starting app:", err);
  process.exit(1);
});
