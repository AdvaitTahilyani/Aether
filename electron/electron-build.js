// electron-build.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Ensure the dist-electron directory exists
const distElectronDir = path.join(__dirname, "../dist-electron/electron");
if (!fs.existsSync(distElectronDir)) {
  fs.mkdirSync(distElectronDir, { recursive: true });
}

console.log("Building Electron main process...");

try {
  // Run TypeScript compiler
  execSync("tsc -p tsconfig.electron.json", { stdio: "inherit" });
  console.log("Main process build completed successfully!");

  // Copy preload.js to dist-electron/electron
  const preloadSrc = path.join(__dirname, "preload.js");
  const preloadDest = path.join(distElectronDir, "preload.js");

  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, preloadDest);
    console.log(`Copied preload.js to ${preloadDest}`);
  } else {
    console.warn(`Warning: preload.js not found at ${preloadSrc}`);
  }
} catch (error) {
  console.error("Error building main process:", error);
  process.exit(1);
}
