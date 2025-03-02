/**
 * llama-runner.js
 *
 * This script is used to run the Llama model in a separate process.
 * It is called by the llama-service.ts file in the main process.
 */

import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "url";
import path from "path";

// Get command line arguments
const command = process.argv[2]; // 'summarize' or 'generate'
const modelPath = process.argv[3];
const content = process.argv[4];
const systemPrompt = process.argv[5] || "You are a helpful AI assistant.";

async function main() {
  try {
    console.log(`Initializing Llama model from: ${modelPath}`);

    // Initialize the model
    const model = new LlamaModel({
      modelPath: modelPath,
      contextSize: 2048,
      batchSize: 512,
      gpuLayers: 0, // Use CPU only for compatibility
    });

    console.log("Model initialized successfully");

    // Create a context and chat session
    const context = new LlamaContext({ model });
    const session = new LlamaChatSession({ context });

    let prompt;

    if (command === "summarize") {
      // Prepare the prompt for summarization
      prompt = `
<|system|>
You are an AI assistant that summarizes emails. Create a concise summary (1-2 sentences) that captures the key points of the email.
</|system|>

<|user|>
Please summarize the following email:

${content}
</|user|>

<|assistant|>`;
    } else if (command === "generate") {
      // Prepare the prompt for response generation
      prompt = `
<|system|>
${systemPrompt}
</|system|>

<|user|>
${content}
</|user|>

<|assistant|>`;
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }

    console.log(
      `Generating ${command === "summarize" ? "summary" : "response"}...`
    );

    // Generate the response
    const response = await session.prompt(prompt, {
      temperature: 0.7,
      maxTokens: command === "summarize" ? 100 : 500,
    });

    console.log("Generation complete");
    console.log(response.trim());
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
