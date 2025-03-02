# AI Server for Email Summarization

This server provides AI capabilities for the Aether email client, including email summarization using the Llama 3 model via Ollama.

## Prerequisites

1. Python 3.8 or higher
2. [Ollama](https://ollama.ai/) installed and running with the Llama 3 model

## Setup Instructions

### 1. Install Ollama

First, you need to install Ollama:

- **macOS/Linux**: Follow the instructions at [https://ollama.ai/](https://ollama.ai/)
- **Windows**: Follow the instructions at [https://ollama.ai/](https://ollama.ai/)

### 2. Pull the Llama 3 Model

After installing Ollama, pull the Llama 3 model:

```bash
ollama pull llama3
```

### 3. Start the Flask Server

#### On macOS/Linux:

1. Open a terminal
2. Navigate to the server directory
3. Run the start script:

```bash
./start_server.sh
```

#### On Windows:

1. Open Command Prompt
2. Navigate to the server directory
3. Run the batch file:

```bash
start_server.bat
```

## Troubleshooting

### Server Not Available

If you see "AI Server Unavailable" in the email client:

1. Make sure Ollama is running
2. Check that the Flask server is running on port 5001
3. Look for any error messages in the terminal where the server is running
4. Try accessing the server directly in a browser at http://localhost:5001/

### CORS Issues

If you encounter CORS errors:

1. Make sure you're using the latest version of the server code
2. Check that the Flask-CORS package is installed
3. Restart the Flask server
4. If issues persist, try running the server with the `--host=0.0.0.0` option to allow connections from any IP

### 403 Forbidden Errors

If you see 403 Forbidden errors:

1. Make sure the Flask server is running with CORS enabled
2. Check that the client is sending the correct headers
3. Try accessing the server directly in a browser at http://localhost:5001/
4. If using a different port, make sure it's not blocked by a firewall

## API Endpoints

- `/` - Health check endpoint
- `/ollama-status` - Check Ollama service status
- `/summarize-email` - Summarize email content
