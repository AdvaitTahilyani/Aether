// Type definitions for Electron API
// This file is being replaced by src/types/electron.ts
// It's kept for backward compatibility

import { ElectronAPI } from "./electron";

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
