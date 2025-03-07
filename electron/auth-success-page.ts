/**
 * Generates the HTML for the authentication success page.
 * @returns {string} HTML content for the success page
 */
export function getAuthSuccessPage(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            text-align: center; 
            padding: 40px;
            background-color: #f5f5f7;
            color: #333;
          }
          h1 { color: #4285f4; }
          p { font-size: 16px; line-height: 1.5; }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authentication Successful!</h1>
          <p>You have successfully authenticated with Google.</p>
          <p>You can now close this window and return to the application.</p>
        </div>
      </body>
    </html>
  `;
}
