import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Authentication methods
  loginWithGoogle: () => ipcRenderer.invoke("login-with-google"),
  checkAuthStatus: () => ipcRenderer.invoke("check-auth-status"),
  logout: () => ipcRenderer.invoke("logout"),

  // Store methods
  storeGet: (key: string) => ipcRenderer.invoke("store-get", key),
  storeSet: (key: string, value: string) => ipcRenderer.invoke("store-set", key, value),

  // Email methods
  getEmails: (maxResults = 10, query?: string) =>
    ipcRenderer.invoke("get-emails", maxResults, query),
  getEmailDetails: (emailId: string) =>
    ipcRenderer.invoke("get-email-details", emailId),
  getThreadEmails: (threadId: string, maxResults = 20) =>
    ipcRenderer.invoke("get-thread-emails", threadId, maxResults),
  deleteEmail: (emailId: string) => ipcRenderer.invoke("delete-email", emailId),
  markEmailAsRead: (emailId: string) =>
    ipcRenderer.invoke("mark-email-as-read", emailId),
  toggleStarEmail: (emailId: string) =>
    ipcRenderer.invoke("toggle-star-email", emailId),
  sendEmail: (params: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    isHtml?: boolean;
    threadId?: string;
  }) => ipcRenderer.invoke("send-email", params),

  // New method for sending email replies
  sendEmailReply: async (params: {
    emailId: string;
    threadId: string;
    content: string;
    to: string;
  }) => {
    return ipcRenderer.invoke("send-email-reply", params);
  },

  // Utility methods
  ping: (message: string) => ipcRenderer.invoke("ping", message),
  testGmailConnection: () => ipcRenderer.invoke("test-gmail-connection"),
  searchEmails: (query: string) => ipcRenderer.invoke("search-emails", query),

  // Flask server methods
  llamaServerStatus: () => ipcRenderer.invoke("llama:server-status"),
  llamaServerUrl: () => ipcRenderer.invoke("llama:server-url"),
  llamaServerLogs: () => ipcRenderer.invoke("llama:server-logs"),
});
