/**
 * llama-service.ts (Main Process)
 *
 * Service for integrating with the Llama model for AI-powered features
 * like email summarization.
 */

import path from "path";
import fs from "fs";
import { app } from "electron";
import { spawn } from "child_process";

// Interface for the summarization result
export interface SummarizationResult {
  success: boolean;
  summary?: string;
  error?: string;
}

class LlamaService {
  private modelPath: string;
  private wrapperScriptPath: string;
  private isInitialized = false;
  private isInitializing = false;

  constructor() {
    // Determine the model path based on whether we're in development or production
    if (app.isPackaged) {
      // In production, use the resources folder
      this.modelPath = path.join(
        process.resourcesPath,
        "models",
        "Meta-Llama-3-8B-Instruct.Q2_K.gguf"
      );
      this.wrapperScriptPath = path.join(
        process.resourcesPath,
        "scripts",
        "llama-wrapper.cjs"
      );
    } else {
      // In development, use the models folder in the project root
      this.modelPath = path.join(
        app.getAppPath(),
        "models",
        "Meta-Llama-3-8B-Instruct.Q2_K.gguf"
      );
      this.wrapperScriptPath = path.join(
        app.getAppPath(),
        "dist-electron",
        "electron",
        "scripts",
        "llama-wrapper.cjs"
      );
    }

    console.log("LlamaService: Model path set to", this.modelPath);
    console.log(
      "LlamaService: Wrapper script path set to",
      this.wrapperScriptPath
    );
  }

  /**
   * Initialize the Llama model
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) return false;

    try {
      this.isInitializing = true;
      console.log("Initializing Llama service...");

      // Check if the model file exists
      if (!fs.existsSync(this.modelPath)) {
        console.error("Model file not found at:", this.modelPath);
        return false;
      }

      // Check if the wrapper script exists
      if (!fs.existsSync(this.wrapperScriptPath)) {
        console.error("Wrapper script not found at:", this.wrapperScriptPath);
        // Try to copy the wrapper script to the correct location
        try {
          const sourceScriptPath = path.join(
            app.getAppPath(),
            "electron",
            "scripts",
            "llama-wrapper.cjs"
          );
          if (fs.existsSync(sourceScriptPath)) {
            // Create the directory if it doesn't exist
            const scriptDir = path.dirname(this.wrapperScriptPath);
            if (!fs.existsSync(scriptDir)) {
              fs.mkdirSync(scriptDir, { recursive: true });
            }
            // Copy the script
            fs.copyFileSync(sourceScriptPath, this.wrapperScriptPath);
            console.log("Copied wrapper script to:", this.wrapperScriptPath);
          } else {
            console.error(
              "Source wrapper script not found at:",
              sourceScriptPath
            );
            return false;
          }
        } catch (error) {
          console.error("Error copying wrapper script:", error);
          return false;
        }
      }

      this.isInitialized = true;
      console.log("Llama service initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Llama service:", error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Run the Llama model in a child process
   * @param command The command to run ('summarize' or 'generate')
   * @param content The content to process
   * @param systemPrompt Optional system prompt for generation
   * @returns The output of the model
   */
  private async runLlamaProcess(
    command: string,
    content: string,
    systemPrompt?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [this.wrapperScriptPath, command, this.modelPath, content];

      if (systemPrompt) {
        args.push(systemPrompt);
      }

      console.log(`Running Llama process with command: ${command}`);
      const child = spawn("node", args);

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        const dataStr = data.toString();
        output += dataStr;
        console.log(`Llama process output: ${dataStr}`);
      });

      child.stderr.on("data", (data) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        console.error(`Llama process error: ${dataStr}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          // Extract the actual response (last line of output)
          const lines = output.trim().split("\n");
          const response = lines[lines.length - 1];
          resolve(response);
        } else {
          // If there's an error, provide a mock response
          console.warn("⚠️ Error running Llama process, using mock response");
          if (command === "summarize") {
            resolve(`This is a mock summary. [ERROR: ${errorOutput}]`);
          } else {
            resolve(`This is a mock response. [ERROR: ${errorOutput}]`);
          }
        }
      });
    });
  }

  /**
   * Summarize an email's content
   * @param emailContent The content of the email to summarize
   * @returns A promise that resolves to the summarization result
   */
  async summarizeEmail(emailContent: string): Promise<SummarizationResult> {
    try {
      // Initialize the service if not already initialized
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return {
            success: false,
            error: "Failed to initialize the Llama service",
          };
        }
      }

      // Run the summarization in a child process
      const summary = await this.runLlamaProcess("summarize", emailContent);

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error("Error summarizing email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a response to a user message
   * @param userMessage The user's message
   * @param systemPrompt Optional system prompt to guide the model's behavior
   * @returns A promise that resolves to the generated response
   */
  async generateResponse(
    userMessage: string,
    systemPrompt: string = "You are a helpful AI assistant."
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Initialize the service if not already initialized
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return {
            success: false,
            error: "Failed to initialize the Llama service",
          };
        }
      }

      // Run the response generation in a child process
      const response = await this.runLlamaProcess(
        "generate",
        userMessage,
        systemPrompt
      );

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error("Error generating response:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isInitialized = false;
    console.log("Llama service disposed");
  }
}

// Export a singleton instance
export const llamaService = new LlamaService();
