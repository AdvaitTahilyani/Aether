const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Determine the Python executable path
const pythonExecutable = process.platform === "win32" ? "python" : "python3";

// Get the path to the Flask app
const appPath = path.join(__dirname, "app.py");

// Create a log file
const logPath = path.join(os.tmpdir(), "aether-flask-server.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

console.log("Starting Flask server...");
console.log(`Log file: ${logPath}`);

// Spawn the Flask server process
const serverProcess = spawn(pythonExecutable, [appPath], {
  stdio: ["ignore", "pipe", "pipe"],
});

// Log server output
serverProcess.stdout.on("data", (data) => {
  const output = data.toString();
  console.log(`[Flask Server]: ${output}`);
  logStream.write(`[STDOUT] ${output}\n`);
});

// Log server errors
serverProcess.stderr.on("data", (data) => {
  const error = data.toString();
  console.error(`[Flask Server Error]: ${error}`);
  logStream.write(`[STDERR] ${error}\n`);
});

// Handle server process exit
serverProcess.on("close", (code) => {
  console.log(`Flask server process exited with code ${code}`);
  logStream.write(`[INFO] Server process exited with code ${code}\n`);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("Stopping Flask server...");
  serverProcess.kill("SIGINT");
  process.exit();
});

process.on("SIGTERM", () => {
  console.log("Stopping Flask server...");
  serverProcess.kill("SIGTERM");
  process.exit();
});
