import React, { useEffect, useState, useRef } from "react";
import { EmailDetails } from "../../types";
import { safeGetEmailBody } from "./SafeEmailBody";
import { useEmailStore } from "../../store/email";
interface EmailBodyProps {
  email: EmailDetails;
  index: number;
  isFirstEmail: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement> | null;
}

const EmailBody: React.FC<EmailBodyProps> = ({
  index,
  isFirstEmail,
  iframeRef,
}) => {
  const { currentSelectedEmail } = useEmailStore();
  const [iframeHeight, setIframeHeight] = useState<number>(0); // Start with 0 height
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [emailContent, setEmailContent] = useState<string>("");
  const [iframeKey, setIframeKey] = useState<string>(
    `email-iframe-${currentSelectedEmail?.id || index}-${Date.now()}`
  );

  // Get email content when email changes
  useEffect(() => {
    const content = safeGetEmailBody(currentSelectedEmail);
    setEmailContent(content);
    // Force iframe re-render with a new key
    setIframeKey(
      `email-iframe-${currentSelectedEmail?.id || index}-${Date.now()}`
    );
  }, [currentSelectedEmail, index]);

  // Function to render HTML content in iframe
  const renderEmailInIframe = (
    htmlContent: string,
    iframeElement: HTMLIFrameElement | null
  ) => {
    if (!iframeElement) return;

    const iframeDoc =
      iframeElement.contentDocument || iframeElement.contentWindow?.document;
    if (!iframeDoc) return;

    // Create a complete HTML document with proper doctype and meta tags
    const completeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              overflow-x: hidden;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            blockquote {
              border-left: 3px solid #ccc;
              margin: 1em 0;
              padding-left: 1em;
              color: #666;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Write the HTML content directly to the iframe
    iframeDoc.open();
    iframeDoc.write(completeHtml);
    iframeDoc.close();

    // Make links open in new tab
    const links = iframeDoc.getElementsByTagName("a");
    for (let i = 0; i < links.length; i++) {
      links[i].setAttribute("target", "_blank");
      links[i].setAttribute("rel", "noopener noreferrer");
    }

    // Set up a resize observer to adjust height when content changes
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    // Function to update iframe height
    const updateIframeHeight = () => {
      try {
        if (!iframeDoc.body) return;

        const bodyHeight = iframeDoc.body.scrollHeight;
        const htmlHeight = iframeDoc.documentElement.scrollHeight;
        const contentHeight = Math.max(bodyHeight, htmlHeight);

        // Set a reasonable maximum height to prevent excessive scrolling
        // Limit to 60% of viewport height to ensure we don't create excessive scrolling
        const maxHeight = Math.min(contentHeight, window.innerHeight * 0.6);
        setIframeHeight(maxHeight);
      } catch (error) {
        console.error("Error adjusting iframe height:", error);
      }
    };

    // Initial height update
    updateIframeHeight();

    // Set up resize observer for dynamic content
    resizeObserverRef.current = new ResizeObserver(updateIframeHeight);
    if (iframeDoc.body) {
      resizeObserverRef.current.observe(iframeDoc.body);
    }

    // Also listen for window resize events
    window.addEventListener("resize", updateIframeHeight);
  };

  // Effect to render email in iframe when content changes
  useEffect(() => {
    // Use a small timeout to ensure the iframe is in the DOM
    const timeoutId = setTimeout(() => {
      const iframe = document.getElementById(
        `email-iframe-${currentSelectedEmail?.id || index}`
      ) as HTMLIFrameElement;

      if (iframe && emailContent) {
        renderEmailInIframe(emailContent, iframe);
      }
    }, 50);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener("resize", () => {});
    };
  }, [emailContent, iframeKey]);

  return (
    <div className="email-content text-gray-700 text-base leading-relaxed m-0 p-0">
      <iframe
        key={iframeKey}
        id={`email-iframe-${currentSelectedEmail?.id || index}`}
        ref={isFirstEmail && iframeRef ? iframeRef : null}
        className="w-full border-none"
        style={{
          height: iframeHeight > 0 ? `${iframeHeight}px` : "auto",
          minHeight: "100px", // Provide a minimum height
          maxHeight: "60vh", // Limit maximum height to 60% of viewport height
          width: "100%",
          overflow: "auto",
          margin: 0,
          padding: 0,
        }}
        sandbox="allow-same-origin allow-popups"
      />
    </div>
  );
};

export default EmailBody;
