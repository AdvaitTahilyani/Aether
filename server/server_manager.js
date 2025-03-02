const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.isRunning = false;
    this.serverUrl = "http://localhost:5001";
  }

  /**
   * Start the Flask server
   * @returns {Promise<string>} A promise that resolves with the server URL when the server is ready
   */
  startServer() {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        console.log("Server is already running");
        resolve(this.serverUrl);
        return;
      }

      console.log("Starting Flask server...");

      // Determine the Python executable path
      const pythonExecutable =
        process.platform === "win32" ? "python" : "python3";

      // Get the path to the Flask app
      const appPath = path.join(__dirname, "app.py");

      // Spawn the Flask server process
      this.serverProcess = spawn(pythonExecutable, [appPath], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      // Check if the server is ready
      this.serverProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[Flask Server]: ${output}`);

        if (output.includes("Running on http://")) {
          this.isRunning = true;
          resolve(this.serverUrl);
        }
      });

      // Log server errors
      this.serverProcess.stderr.on("data", (data) => {
        const error = data.toString();
        console.error(`[Flask Server Error]: ${error}`);

        // Some Flask startup messages go to stderr, so we also check here
        if (error.includes("Running on http://")) {
          this.isRunning = true;
          resolve(this.serverUrl);
        }
      });

      // Handle server process exit
      this.serverProcess.on("close", (code) => {
        console.log(`Flask server process exited with code ${code}`);
        this.isRunning = false;
        this.serverProcess = null;

        if (code !== 0 && !this.isRunning) {
          reject(new Error(`Flask server process exited with code ${code}`));
        }
      });

      // Set a timeout in case the server doesn't start
      setTimeout(() => {
        if (!this.isRunning) {
          reject(
            new Error("Flask server failed to start within the timeout period")
          );
        }
      }, 30000); // 30 seconds timeout
    });
  }

  /**
   * Stop the Flask server
   */
  stopServer() {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.serverProcess) {
        console.log("Server is not running");
        resolve();
        return;
      }

      console.log("Stopping Flask server...");

      // Kill the server process
      if (process.platform === "win32") {
        // On Windows, we need to kill the process tree
        spawn("taskkill", ["/pid", this.serverProcess.pid, "/f", "/t"]);
      } else {
        // On Unix-like systems, we can kill the process group
        process.kill(-this.serverProcess.pid, "SIGTERM");
      }

      this.serverProcess = null;
      this.isRunning = false;
      resolve();
    });
  }

  /**
   * Check if the server is running
   * @returns {boolean} True if the server is running, false otherwise
   */
  isServerRunning() {
    return this.isRunning;
  }

  /**
   * Get the server URL
   * @returns {string} The server URL
   */
  getServerUrl() {
    return this.serverUrl;
  }
}

module.exports = ServerManager;
