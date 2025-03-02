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
      storeGet: (key) => ipcRenderer.invoke("store-get", key),
      storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
      loginWithGoogle: () => ipcRenderer.invoke("login-with-google"),
      getEmails: (maxResults, query) =>
        ipcRenderer.invoke("get-emails", maxResults, query),
      getEmailDetails: (emailId) =>
        ipcRenderer.invoke("get-email-details", emailId),
      getThreadEmails: (threadId, maxResults) =>
        ipcRenderer.invoke("get-thread-emails", threadId, maxResults),
      checkAuthStatus: () => ipcRenderer.invoke("check-auth-status"),
      logout: () => ipcRenderer.invoke("logout"),
      deleteEmail: (emailId) => ipcRenderer.invoke("delete-email", emailId),
      markEmailAsRead: (emailId) =>
        ipcRenderer.invoke("mark-email-as-read", emailId),
      // Add a simple test method that doesn't require authentication
      ping: () => Promise.resolve("pong"),
      // Add the sendEmail method
      sendEmail: ({ to, cc = "", bcc = "", subject, body, isHtml = false }) =>
        ipcRenderer.invoke("send-email", {
          to,
          cc,
          bcc,
          subject,
          body,
          isHtml,
        }),
      // Add the toggleStarEmail method
      toggleStarEmail: (emailId) =>
        ipcRenderer.invoke("toggle-star-email", emailId),
      // Add the searchEmails method
      searchEmails: (query) => ipcRenderer.invoke("search-emails", query),

      // Add Llama server functions
      llamaServerStatus: () => ipcRenderer.invoke("llama:server-status"),
      llamaServerUrl: () => ipcRenderer.invoke("llama:server-url"),
      llamaServerLogs: () => ipcRenderer.invoke("llama:server-logs"),
    });

    console.log("electronAPI has been exposed to the renderer process");
    console.log(
      "Available methods:",
      Object.keys(contextBridge.exposeInMainWorld.arguments[1]).join(", ")
    );
  } catch (error) {
    console.error("Error exposing electronAPI:", error);
  }
}

// Add a global variable to check in the renderer
if (typeof window !== "undefined") {
  console.log("Window object is available in preload");
}
