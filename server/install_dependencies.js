const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Determine the Python executable path
const pythonExecutable = process.platform === "win32" ? "python" : "python3";

// Get the path to the requirements.txt file
const requirementsPath = path.join(__dirname, "requirements.txt");

// Create a log file
const logPath = path.join(os.tmpdir(), "aether-install-dependencies.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

console.log("Installing Python dependencies...");
console.log(`Log file: ${logPath}`);

// Spawn the pip install process
const pipProcess = spawn(
  pythonExecutable,
  ["-m", "pip", "install", "-r", requirementsPath],
  {
    stdio: ["ignore", "pipe", "pipe"],
  }
);

// Log process output
pipProcess.stdout.on("data", (data) => {
  const output = data.toString();
  console.log(`[pip]: ${output}`);
  logStream.write(`[STDOUT] ${output}\n`);
});

// Log process errors
pipProcess.stderr.on("data", (data) => {
  const error = data.toString();
  console.error(`[pip error]: ${error}`);
  logStream.write(`[STDERR] ${error}\n`);
});

// Handle process exit
pipProcess.on("close", (code) => {
  console.log(`pip process exited with code ${code}`);
  logStream.write(`[INFO] pip process exited with code ${code}\n`);

  if (code === 0) {
    console.log("Python dependencies installed successfully");

    // Check if Ollama is installed
    console.log("Checking if Ollama is installed...");

    const ollamaCheckProcess = spawn("ollama", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    ollamaCheckProcess.on("error", () => {
      console.error(
        "Ollama is not installed. Please install it from https://ollama.com/"
      );
      logStream.write("[ERROR] Ollama is not installed\n");
    });

    ollamaCheckProcess.stdout.on("data", (data) => {
      console.log(`Ollama version: ${data.toString().trim()}`);
      logStream.write(`[INFO] Ollama version: ${data.toString().trim()}\n`);

      // Pull the Llama 3 model
      console.log("Pulling Llama 3 model...");

      const ollamaPullProcess = spawn("ollama", ["pull", "llama3"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      ollamaPullProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[ollama]: ${output}`);
        logStream.write(`[STDOUT] ${output}\n`);
      });

      ollamaPullProcess.stderr.on("data", (data) => {
        const error = data.toString();
        console.error(`[ollama error]: ${error}`);
        logStream.write(`[STDERR] ${error}\n`);
      });

      ollamaPullProcess.on("close", (code) => {
        console.log(`ollama pull process exited with code ${code}`);
        logStream.write(
          `[INFO] ollama pull process exited with code ${code}\n`
        );

        if (code === 0) {
          console.log("Llama 3 model pulled successfully");
        } else {
          console.error("Failed to pull Llama 3 model");
        }
      });
    });
  } else {
    console.error("Failed to install Python dependencies");
  }
});
