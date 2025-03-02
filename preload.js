
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
