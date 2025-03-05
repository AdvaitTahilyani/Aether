import { EmailDetails } from "../types";
import {
  getEmailSubject,
  getEmailSender,
  formatDate,
  decodeBase64,
} from "../services";
import EmailSummarizer from "./EmailSummarizer";
import { useEmailStore } from "../store/email";
import NoEmailSelected from "./viewer-components/NoEmailSelected";

const EmailDetail = () => {
  const { currentSelectedEmail } = useEmailStore();

  if (!currentSelectedEmail) {
    return <NoEmailSelected />;
  }

  // Extract raw email content without sanitization (WARNING: SECURITY RISK)
  const getRawEmailBody = (email: EmailDetails): string => {
    try {
      // Check for HTML content first
      if (email.payload?.parts) {
        const htmlPart = email.payload.parts.find(
          (part) => part.mimeType === "text/html"
        );
        if (htmlPart?.body?.data) {
          return decodeBase64(htmlPart.body.data);
        }

        // If no HTML, try plain text
        const textPart = email.payload.parts.find(
          (part) => part.mimeType === "text/plain"
        );
        if (textPart?.body?.data) {
          return decodeBase64(textPart.body.data);
        }
      }

      // If no parts, try the main body
      if (email.payload?.body?.data) {
        return decodeBase64(email.payload.body.data);
      }

      // Last resort, use snippet
      return email.snippet || "No content available";
    } catch (error) {
      console.error("Error getting raw email body:", error);
      return "Error displaying email content";
    }
  };

  // Get raw unsanitized email content
  const emailBody = getRawEmailBody(currentSelectedEmail);

  // Determine if content is HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(emailBody);

  return (
    <div className="h-full flex flex-col bg-white p-6">
      {/* Email header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-black mb-4">
          {getEmailSubject(currentSelectedEmail)}
        </h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-black text-lg">
              From: {getEmailSender(currentSelectedEmail)}
            </p>
            <p className="text-black text-sm mt-1">To: You</p>
          </div>
          <span className="text-sm text-gray-600">
            {formatDate(currentSelectedEmail.internalDate)}
          </span>
        </div>
      </div>

      {/* AI Summary */}
      <EmailSummarizer email={currentSelectedEmail} />

      {/* Email body */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          {isHtml ? (
            <div
              className="email-content text-black"
              dangerouslySetInnerHTML={{ __html: emailBody }}
              style={{ width: "100%" }}
            />
          ) : (
            <pre
              className="email-content text-black whitespace-pre-wrap"
              style={{ width: "100%" }}
            >
              {emailBody}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
