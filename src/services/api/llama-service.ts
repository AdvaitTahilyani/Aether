import axios from "axios";

/**
 * Service for interacting with the Llama model via the Flask server
 */
export class LlamaService {
  private baseUrl: string;
  private timeoutMs: number;

  /**
   * Create a new LlamaService
   * @param baseUrl The base URL of the Flask server
   * @param timeoutMs Timeout for requests in milliseconds
   */
  constructor(
    baseUrl: string = "http://localhost:5001",
    timeoutMs: number = 30000
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generate text using the Llama model
   * @param prompt The prompt to generate text from
   * @param model The model to use (default: llama3)
   * @returns The generated text
   */
  async generateText(
    prompt: string,
    model: string = "llama3"
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/generate`,
        { prompt, model },
        {
          timeout: this.timeoutMs,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          validateStatus: (status) => status < 500, // Don't reject on 4xx errors
        }
      );

      // Check if the response is successful
      if (response.status !== 200) {
        throw new Error(
          `Server returned ${response.status}: ${
            response.data?.error || response.statusText
          }`
        );
      }

      return response.data.response;
    } catch (error) {
      console.error("Error generating text:", error);

      // Provide more specific error messages based on the error type
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          throw new Error(
            "Cannot connect to the AI server. Please make sure the Flask server is running."
          );
        } else if (error.response) {
          if (error.response.status === 403) {
            throw new Error(
              "Access to the AI server is forbidden. This may be due to CORS restrictions. Please check the server configuration."
            );
          } else if (error.response.status === 503) {
            throw new Error(
              "Ollama is not available. Please make sure Ollama is running and the Llama 3 model is installed."
            );
          }

          // Try to extract error message from response
          const errorMessage =
            error.response.data?.error || error.response.statusText;
          throw new Error(
            `Server error: ${error.response.status} - ${errorMessage}`
          );
        } else if (error.request) {
          throw new Error(
            "No response from server. Please check your network connection."
          );
        }
      }

      throw new Error(
        `Failed to generate text: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Summarize an email using the Llama model
   * @param emailContent The content of the email to summarize
   * @param model The model to use (default: llama3)
   * @returns The email summary
   */
  async summarizeEmail(
    emailContent: string,
    model: string = "llama3"
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/summarize-email`,
        { content: emailContent, model },
        {
          timeout: this.timeoutMs,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          validateStatus: (status) => status < 500, // Don't reject on 4xx errors
        }
      );

      // Check if the response is successful
      if (response.status !== 200) {
        throw new Error(
          `Server returned ${response.status}: ${
            response.data?.error || response.statusText
          }`
        );
      }

      return response.data.summary;
    } catch (error) {
      console.error("Error summarizing email:", error);

      // Provide more specific error messages based on the error type
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          throw new Error(
            "Cannot connect to the AI server. Please make sure the Flask server is running."
          );
        } else if (error.response) {
          if (error.response.status === 403) {
            throw new Error(
              "Access to the AI server is forbidden. This may be due to CORS restrictions. Please check the server configuration."
            );
          } else if (error.response.status === 503) {
            throw new Error(
              "Ollama is not available. Please make sure Ollama is running and the Llama 3 model is installed."
            );
          }

          // Try to extract error message from response
          const errorMessage =
            error.response.data?.error || error.response.statusText;
          throw new Error(
            `Server error: ${error.response.status} - ${errorMessage}`
          );
        } else if (error.request) {
          throw new Error(
            "No response from server. Please check your network connection."
          );
        }
      }

      throw new Error(
        `Failed to summarize email: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Upload an audio file for transcription and summarization
   * @param file The audio file to upload
   * @returns Object containing paths to the transcript and summary files
   */
  async uploadAudio(
    file: File
  ): Promise<{ transcript_file_path: string; docx_file_path: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${this.baseUrl}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
        timeout: this.timeoutMs,
        validateStatus: (status) => status < 500, // Don't reject on 4xx errors
      });

      // Check if the response is successful
      if (response.status !== 200) {
        throw new Error(
          `Server returned ${response.status}: ${
            response.data?.error || response.statusText
          }`
        );
      }

      return {
        transcript_file_path: response.data.transcript_file_path,
        docx_file_path: response.data.docx_file_path,
      };
    } catch (error) {
      console.error("Error uploading audio:", error);

      // Provide more specific error messages based on the error type
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          throw new Error(
            "Cannot connect to the AI server. Please make sure the Flask server is running."
          );
        } else if (error.response) {
          if (error.response.status === 403) {
            throw new Error(
              "Access to the AI server is forbidden. This may be due to CORS restrictions. Please check the server configuration."
            );
          } else if (error.response.status === 503) {
            throw new Error(
              "Ollama is not available. Please make sure Ollama is running and the Llama 3 model is installed."
            );
          }

          // Try to extract error message from response
          const errorMessage =
            error.response.data?.error || error.response.statusText;
          throw new Error(
            `Server error: ${error.response.status} - ${errorMessage}`
          );
        } else if (error.request) {
          throw new Error(
            "No response from server. Please check your network connection."
          );
        }
      }

      throw new Error(
        `Failed to upload audio: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Check if the server is available
   * @returns True if the server is available, false otherwise
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}`, {
        timeout: 5000,
        headers: {
          Accept: "application/json",
        },
        validateStatus: (status) => true, // Accept any status code
      });

      // Only consider 200 OK as success
      return response.status === 200;
    } catch (error) {
      console.error("Error checking server availability:", error);
      return false;
    }
  }

  /**
   * Check if Ollama is available
   * @returns Object containing status and message
   */
  async isOllamaAvailable(): Promise<{ available: boolean; message: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/ollama-status`, {
        timeout: 5000,
        headers: {
          Accept: "application/json",
        },
        validateStatus: (status) => true, // Accept any status code
      });

      if (response.status === 200 && response.data.status === "ok") {
        return { available: true, message: response.data.message };
      } else {
        return {
          available: false,
          message: response.data?.message || "Ollama is not available",
        };
      }
    } catch (error) {
      console.error("Error checking Ollama availability:", error);

      if (axios.isAxiosError(error) && error.code === "ECONNREFUSED") {
        return {
          available: false,
          message:
            "Cannot connect to the AI server. Please make sure the Flask server is running.",
        };
      }

      return {
        available: false,
        message: "Failed to check Ollama status",
      };
    }
  }

  /**
   * Get detailed server status including Ollama status
   * @returns Object containing server and Ollama status
   */
  async getServerStatus(): Promise<{
    serverAvailable: boolean;
    ollamaAvailable: boolean;
    message: string;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}`, {
        timeout: 5000,
        headers: {
          Accept: "application/json",
        },
        validateStatus: (status) => true, // Accept any status code
      });

      if (response.status !== 200) {
        return {
          serverAvailable: false,
          ollamaAvailable: false,
          message: "Server is not available",
        };
      }

      // Check if the response includes Ollama status
      if (response.data.ollama_status) {
        const ollamaAvailable = response.data.ollama_status === "running";
        return {
          serverAvailable: true,
          ollamaAvailable,
          message: ollamaAvailable
            ? "Server and Ollama are running"
            : response.data.ollama_error || "Ollama is not available",
        };
      }

      // If the response doesn't include Ollama status, check it separately
      const ollamaStatus = await this.isOllamaAvailable();
      return {
        serverAvailable: true,
        ollamaAvailable: ollamaStatus.available,
        message: ollamaStatus.message,
      };
    } catch (error) {
      console.error("Error getting server status:", error);
      return {
        serverAvailable: false,
        ollamaAvailable: false,
        message: "Failed to connect to the server",
      };
    }
  }
}
