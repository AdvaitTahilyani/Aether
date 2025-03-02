/**
 * llama-service.ts
 *
 * Service for integrating with the Llama model for AI-powered features
 * like email summarization.
 */

import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
import path from "path";
import fs from "fs";
import { app } from "electron";

// Interface for the summarization result
export interface SummarizationResult {
  success: boolean;
  summary?: string;
  error?: string;
}

class LlamaService {
  private model: LlamaModel | null = null;
  private modelPath: string;
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
    } else {
      // In development, use the models folder in the project root
      this.modelPath = path.join(
        app.getAppPath(),
        "models",
        "Meta-Llama-3-8B-Instruct.Q2_K.gguf"
      );
    }
  }

  /**
   * Initialize the Llama model
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) return false;

    try {
      this.isInitializing = true;
      console.log("Initializing Llama model from:", this.modelPath);

      // Check if the model file exists
      if (!fs.existsSync(this.modelPath)) {
        console.error("Model file not found at:", this.modelPath);
        return false;
      }

      // Initialize the model with appropriate parameters
      // @ts-ignore - Ignoring TypeScript errors related to private constructor
      this.model = new LlamaModel({
        modelPath: this.modelPath,
        contextSize: 2048,
        batchSize: 512,
        gpuLayers: 0, // Use CPU only for compatibility
      });

      this.isInitialized = true;
      console.log("Llama model initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Llama model:", error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Summarize an email's content
   * @param emailContent The content of the email to summarize
   * @returns A promise that resolves to the summarization result
   */
  async summarizeEmail(emailContent: string): Promise<SummarizationResult> {
    try {
      // Initialize the model if not already initialized
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return {
            success: false,
            error: "Failed to initialize the Llama model",
          };
        }
      }

      if (!this.model) {
        return {
          success: false,
          error: "Llama model is not available",
        };
      }

      // Prepare the prompt for summarization
      const prompt = `
<|system|>
You are an AI assistant that summarizes emails. Create a concise summary (1-2 sentences) that captures the key points of the email.
</|system|>

<|user|>
Please summarize the following email:

${emailContent}
</|user|>

<|assistant|>`;

      // Create a context and chat session
      // @ts-ignore - Ignoring TypeScript errors related to private constructor
      const context = new LlamaContext({ model: this.model });
      // @ts-ignore - Ignoring TypeScript errors related to constructor options
      const session = new LlamaChatSession({ context });

      // Generate the summary
      const response = await session.prompt(prompt, {
        temperature: 0.7,
        maxTokens: 100,
      });

      return {
        success: true,
        summary: response.trim(),
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
   * Dispose of the model and free resources
   */
  dispose(): void {
    if (this.model) {
      try {
        console.log("Disposing Llama model");
        this.model = null;
        this.isInitialized = false;
      } catch (error) {
        console.error("Error disposing Llama model:", error);
      }
    }
  }
}

// Export a singleton instance
export const llamaService = new LlamaService();
