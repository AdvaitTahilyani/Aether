/**
 * llama-client.ts (Renderer Process)
 *
 * Client for the Llama service that communicates with the main process via IPC.
 * This is the renderer-side counterpart to the main process llama-service.ts.
 */

// Define the interface for the summarization result
export interface SummarizationResult {
  success: boolean;
  summary?: string;
  error?: string;
}

// Define the interface for the response generation result
export interface ResponseGenerationResult {
  success: boolean;
  response?: string;
  error?: string;
}

// We don't need to redeclare the window.electronAPI interface here
// as it's already defined in the preload script

/**
 * Client for the Llama service that communicates with the main process.
 */
class LlamaClient {
  /**
   * Summarize an email's content
   * @param emailContent The content of the email to summarize
   * @returns A promise that resolves to the summarization result
   */
  async summarizeEmail(emailContent: string): Promise<SummarizationResult> {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      // Use type assertion to access the method
      return await (window.electronAPI as any).summarizeEmail(emailContent);
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
    systemPrompt?: string
  ): Promise<ResponseGenerationResult> {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      // Use type assertion to access the method
      return await (window.electronAPI as any).generateResponse(
        userMessage,
        systemPrompt
      );
    } catch (error) {
      console.error("Error generating response:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export a singleton instance
export const llamaClient = new LlamaClient();
