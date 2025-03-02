import { useState, useEffect } from 'react';
import { EmailDetails } from '../types';
import { safeGetEmailBody } from './EmailViewer';
import { getEmailSender, parseEmailAddress } from '../services';
import { isElectronAPIAvailable } from '../services';

interface AutoReplyGeneratorProps {
  email: EmailDetails;
  onReplyGenerated: (reply: string) => void;
  userEmail?: string;
}

const AutoReplyGenerator: React.FC<AutoReplyGeneratorProps> = ({ 
  email, 
  onReplyGenerated,
  userEmail = "user@example.com"
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStoredReplyOrGenerate();
  }, [email, userEmail]);

  // Helper function to create a consistent key for storing replies
  const getReplyStoreKey = (emailId: string): string => {
    return `auto-reply-${emailId}`;
  };

  const checkStoredReplyOrGenerate = async () => {
    if (!email.id) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // First check if we have a stored reply for this email
      if (isElectronAPIAvailable() && window.electronAPI?.storeGet) {
        const storeKey = getReplyStoreKey(email.id);
        const storedReply = await window.electronAPI.storeGet(storeKey);
        
        // If we have a stored reply, use it
        if (storedReply) {
          console.log('Using stored reply for email:', email.id);
          onReplyGenerated(storedReply);
          setIsGenerating(false);
          return;
        }
      }
      
      // If no stored reply, generate a new one
      await generateReply();
    } catch (err) {
      console.error('Error checking stored reply:', err);
      // Continue with generating a new reply
      await generateReply();
    }
  };

  const generateReply = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Extract relevant information from the email
      const emailBody = safeGetEmailBody(email);
      
      // Get recipient information (the sender of the original email)
      const sender = getEmailSender(email);
      const { name: recipientName, email: recipientEmail } = parseEmailAddress(sender);
      
      // Extract subject from email headers
      const emailSubject = email.payload?.headers?.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      
      // Check if we can access the API server
      let useApiServer = false;
      
      try {
        // Try to check if the server is available
        const response = await fetch('http://localhost:5001/ollama-status', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          useApiServer = data.status === 'ok';
        }
      } catch (err) {
        console.log('API server not available, using fallback generation');
        useApiServer = false;
      }
      
      let generatedReply = '';
      
      if (useApiServer) {
        // Make API call to generate reply
        const response = await fetch('http://localhost:5001/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailContent: stripHtmlTags(emailBody),
            emailSubject: emailSubject,
            sender: sender,
            userEmail: userEmail,
            recipientName: recipientName || '',
            recipientEmail: recipientEmail || ''
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate reply from API');
        }

        const data = await response.json();
        if (data.reply) {
          generatedReply = data.reply;
        } else {
          // Fallback to local generation if API returns empty result
          generatedReply = createSimpleReply(stripHtmlTags(emailBody), email, userEmail);
        }
      } else {
        // Fallback to local generation if API is not available
        generatedReply = createSimpleReply(stripHtmlTags(emailBody), email, userEmail);
      }
      
      // Store the generated reply
      if (email.id && isElectronAPIAvailable() && window.electronAPI?.storeSet) {
        const storeKey = getReplyStoreKey(email.id);
        await window.electronAPI.storeSet(storeKey, generatedReply);
        console.log('Stored auto-reply for email:', email.id);
      }
      
      // Return the generated reply
      onReplyGenerated(generatedReply);
    } catch (err) {
      console.error('Error generating reply:', err);
      setError('Failed to generate auto-reply');
      
      // Fallback to local generation on error
      try {
        const emailBody = safeGetEmailBody(email);
        const generatedReply = createSimpleReply(stripHtmlTags(emailBody), email, userEmail);
        
        // Store the fallback reply
        if (email.id && isElectronAPIAvailable() && window.electronAPI?.storeSet) {
          const storeKey = getReplyStoreKey(email.id);
          await window.electronAPI.storeSet(storeKey, generatedReply);
        }
        
        onReplyGenerated(generatedReply);
      } catch (fallbackErr) {
        console.error('Error with fallback reply generation:', fallbackErr);
        onReplyGenerated('');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to strip HTML tags
  const stripHtmlTags = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  // Simple reply generator based on email content
  const createSimpleReply = (content: string, email: EmailDetails, userEmail: string): string => {
    // Extract the sender's name
    let senderName = '';
    if (email.payload?.headers) {
      const fromHeader = email.payload.headers.find(h => h.name.toLowerCase() === 'from');
      if (fromHeader?.value) {
        // Extract just the name part if possible
        const match = fromHeader.value.match(/^([^<]+)/);
        if (match && match[1]) {
          senderName = match[1].trim();
        } else {
          senderName = fromHeader.value;
        }
      }
    }
    
    // If no name was found, use a generic greeting
    const greeting = senderName ? `Hi ${senderName},` : 'Hello,';
    
    // Create a contextual response based on content keywords
    let responseBody = '';
    
    if (content.length < 50) {
      responseBody = "Thanks for your message. I've received it and will get back to you soon.";
    } else if (content.toLowerCase().includes('meeting') || content.toLowerCase().includes('schedule') || content.toLowerCase().includes('appointment')) {
      responseBody = "Thank you for suggesting a meeting. I'm available this week on Tuesday and Thursday afternoon. Would either of those work for you?";
    } else if (content.toLowerCase().includes('question') || content.toLowerCase().includes('help') || content.toLowerCase().includes('support')) {
      responseBody = "Thanks for reaching out. I'll look into this and get back to you with more information shortly.";
    } else if (content.toLowerCase().includes('deadline') || content.toLowerCase().includes('urgent') || content.toLowerCase().includes('asap')) {
      responseBody = "I understand this is time-sensitive. I'll prioritize this and respond with an update by the end of the day.";
    } else {
      responseBody = "Thank you for your email. I've received your message and will respond properly soon.";
    }
    
    // Extract user name from email
    const userNameMatch = userEmail.match(/^([^@]+)@/);
    const userName = userNameMatch ? userNameMatch[1].charAt(0).toUpperCase() + userNameMatch[1].slice(1) : 'Me';
    
    return `${greeting}\n\n${responseBody}\n\nBest regards,\n${userName}`;
  };

  return null; // This component doesn't render anything
};

export default AutoReplyGenerator; 