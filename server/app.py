from flask import Flask, request, jsonify, make_response
import ssl
from langchain_community.llms import Ollama
from flask_cors import CORS
import requests
import time
import argparse

# SSL context for HTTPS requests
ssl._create_default_https_context = ssl._create_unverified_context

app = Flask(__name__)
# Enable CORS with more permissive settings
CORS(app, resources={r"/*": {"origins": "*", "allow_headers": "*", "methods": "*"}})

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Handle OPTIONS requests for all routes
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = make_response(jsonify({'status': 'ok'}))
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Handle 404 errors
@app.errorhandler(404)
def not_found(e):
    return jsonify(error=str(e)), 404

# Handle 403 errors
@app.errorhandler(403)
def forbidden(e):
    return jsonify(error=str(e)), 403

# Handle 500 errors
@app.errorhandler(500)
def server_error(e):
    return jsonify(error=str(e)), 500

# Check if Ollama is running
def check_ollama():
    """
    Check if Ollama is running and the Llama 3.2 1B model is available.
    
    Returns:
        tuple: (is_running, error_message)
    """
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            models = response.json().get("models", [])
            llama3_models = [model for model in models if "llama3.2:1b" in model.get("name", "").lower()]
            
            if llama3_models:
                return True, None
            else:
                return False, "Llama 3.2 1B model is not available. Please run 'ollama pull llama3.2:1b'"
        else:
            return False, f"Ollama returned status code {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Cannot connect to Ollama. Please make sure Ollama is running"
    except Exception as e:
        return False, f"Error checking Ollama: {str(e)}"

# Check Ollama status at startup
ollama_running, ollama_error = check_ollama()

@app.route('/summarize-email', methods=['POST'])
def summarize_email():
    """
    Endpoint to summarize an email using the Llama 3.2 1B model via Ollama.
    """
    data = request.json
    
    if not data or 'content' not in data:
        return jsonify({'error': 'No email content provided'}), 400
    
    email_content = data['content']
    model_name = data.get('model', 'llama3.2:1b')  # Explicitly use llama3.2:1b
    
    # Check Ollama status
    ollama_running, ollama_error = check_ollama()
    if not ollama_running:
        return jsonify({'error': ollama_error}), 503  # Service Unavailable
    
    try:
        llm = Ollama(model=model_name)
        
        # Create a prompt specifically for email summarization
        prompt = f"""Please summarize the following email IN 40 WORDS OR LESS, concisely. The email might include html tags or other content. Do your best to interpret this, and provide only the summary without any leading text or explanation of what it is. I dont want an interpretation of the HTML, I was a summary of what a website with that HTML might be trying to tell me. LIMIT YOUR RESPONSE TO 40 WORDS. THIS IS CRITICAL.:

{email_content}

Summary:"""         
        
        # Generate the summary
        response = llm.invoke(prompt)
        summary = response.strip()
        
        # Return the summary
        return jsonify({'summary': summary}), 200
        
    except Exception as e:
        error_msg = str(e)
        
        # Check if it's a connection error
        if "Connection refused" in error_msg:
            return jsonify({'error': 'Cannot connect to Ollama. Please make sure Ollama is running'}), 503
            
        return jsonify({'error': f'Error summarizing email: {error_msg}'}), 500

@app.route('/generate-reply', methods=['POST'])
def generate_reply():
    """
    Endpoint to generate a contextual reply to an email using the Llama 3.2 1B model via Ollama.
    """
    data = request.json
    
    if not data or 'emailContent' not in data:
        return jsonify({'error': 'No email content provided'}), 400
    
    email_content = data['emailContent']
    email_subject = data.get('emailSubject', '')
    sender = data.get('sender', '')
    user_email = data.get('userEmail', 'user@example.com')
    recipient_name = data.get('recipientName', '')
    recipient_email = data.get('recipientEmail', '')
    model_name = data.get('model', 'llama3.2:1b')  # Explicitly use llama3.2:1b
    
    # Check Ollama status
    ollama_running, ollama_error = check_ollama()
    if not ollama_running:
        return jsonify({'error': ollama_error}), 503  # Service Unavailable
    
    try:
        llm = Ollama(model=model_name)
        
        # Extract sender name if possible
        sender_name = recipient_name or ""
        if not sender_name and sender:
            name_match = sender.split('<')[0].strip()
            if name_match:
                sender_name = name_match
        
        # Extract user name from email
        user_name = "Me"
        if user_email and '@' in user_email:
            user_name_match = user_email.split('@')[0]
            if user_name_match:
                user_name = user_name_match.capitalize()
        
        greeting = f"Hi {sender_name}," if sender_name else "Hello,"
        
        # Create a prompt specifically for email reply generation
        prompt = f"""Generate a professional and friendly reply to the following email. The reply should be contextual, addressing the main points or questions in the original email. Keep the tone professional but warm. Include a greeting and sign-off.

Original Email Subject: {email_subject}
Original Email Content: {email_content}
Original Email Sender: {sender}
My Email Address: {user_email}
Recipient Name: {sender_name}
Recipient Email: {recipient_email}

Your reply should:
1. Acknowledge the email
2. Address the main points or questions
3. Be concise (3-5 sentences)
4. End with a professional sign-off using my name ({user_name})

Reply:"""
        
        # Generate the reply
        response = llm.invoke(prompt)
        reply = response.strip()
        
        # If the reply doesn't include a greeting, add one
        if not reply.startswith("Hi") and not reply.startswith("Hello") and not reply.startswith("Dear"):
            reply = f"{greeting}\n\n{reply}"
            
        # If the reply doesn't include a sign-off, add one
        if not "regards" in reply.lower() and not "sincerely" in reply.lower() and not "best" in reply.lower():
            reply = f"{reply}\n\nBest regards,\n{user_name}"
        
        # Return the reply
        return jsonify({'reply': reply}), 200
        
    except Exception as e:
        error_msg = str(e)
        
        # Check if it's a connection error
        if "Connection refused" in error_msg:
            return jsonify({'error': 'Cannot connect to Ollama. Please make sure Ollama is running'}), 503
            
        return jsonify({'error': f'Error generating reply: {error_msg}'}), 500

@app.route('/', methods=['GET'])
def health_check():
    """
    Simple health check endpoint to verify the server is running.
    """
    # Check Ollama status
    ollama_running, ollama_error = check_ollama()
    
    if ollama_running:
        return jsonify({
            'status': 'ok',
            'message': 'Flask server is running',
            'ollama_status': 'running'
        })
    else:
        return jsonify({
            'status': 'warning',
            'message': 'Flask server is running, but Ollama has issues',
            'ollama_status': 'error',
            'ollama_error': ollama_error
        }), 200  # Still return 200 as the server itself is running

@app.route('/ollama-status', methods=['GET'])
def ollama_status():
    """
    Endpoint to check the status of Ollama.
    """
    ollama_running, ollama_error = check_ollama()
    
    if ollama_running:
        return jsonify({
            'status': 'ok',
            'message': 'Ollama is running and Llama 3.2 1B model is available'
        })
    else:
        return jsonify({
            'status': 'error',
            'message': ollama_error
        }), 503  # Service Unavailable

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run the Flask server')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on')
    args = parser.parse_args()
    
    app.run(debug=True, host='0.0.0.0', port=args.port) 