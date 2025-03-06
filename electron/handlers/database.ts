import { ipcMain } from "electron";
import { db } from "../database";
import { emails } from "../database/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export function registerDatabaseHandlers() {
  // Get emails from the database based on category
  ipcMain.handle("get-emails-from-db", async (_, category = "inbox") => {
    try {
      // Create a base query
      let whereCondition;

      // Filter based on category
      switch (category) {
        case "inbox":
          whereCondition = sql`${emails.id} LIKE '%INBOX%'`;
          break;
        case "starred":
          whereCondition = sql`${emails.id} LIKE '%STARRED%'`;
          break;
        case "sent":
          whereCondition = sql`${emails.id} LIKE '%SENT%'`;
          break;
        case "spam":
          whereCondition = sql`${emails.id} LIKE '%SPAM%'`;
          break;
        case "trash":
          whereCondition = sql`${emails.id} LIKE '%TRASH%'`;
          break;
        default:
          whereCondition = sql`1=1`; // No filter
      }

      // Execute the query with the condition
      const results = await db
        .select()
        .from(emails)
        .where(whereCondition)
        .orderBy(desc(emails.date));

      return results.map((email) => {
        // Convert database email to EmailDetails format
        return {
          id: email.id,
          threadId: email.threadId,
          from: email.from ? JSON.parse(email.from) : null,
          to: email.to ? JSON.parse(email.to) : null,
          cc: email.cc ? JSON.parse(email.cc) : null,
          bcc: email.bcc ? JSON.parse(email.bcc) : null,
          subject: email.subject,
          body: email.body,
          mimeType: email.mimeType,
          internalDate: email.date?.toString(),
          isRead: email.isRead,
        };
      });
    } catch (error) {
      console.error("Error getting emails from database:", error);
      return [];
    }
  });

  // Save email to the database
  ipcMain.handle("save-email-to-db", async (_, emailDetails) => {
    try {
      // Check if email already exists
      const existingEmail = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailDetails.id))
        .limit(1);

      if (existingEmail.length > 0) {
        // Update existing email
        await db
          .update(emails)
          .set({
            from: emailDetails.from ? JSON.stringify(emailDetails.from) : null,
            to: emailDetails.to ? JSON.stringify(emailDetails.to) : null,
            cc: emailDetails.cc ? JSON.stringify(emailDetails.cc) : null,
            bcc: emailDetails.bcc ? JSON.stringify(emailDetails.bcc) : null,
            subject: emailDetails.subject,
            body: emailDetails.body,
            mimeType: emailDetails.mimeType,
            date: emailDetails.internalDate
              ? new Date(parseInt(emailDetails.internalDate))
              : null,
            isRead: emailDetails.isRead,
          })
          .where(eq(emails.id, emailDetails.id));
      } else {
        // Insert new email
        await db.insert(emails).values({
          id: emailDetails.id,
          threadId: emailDetails.threadId,
          account: emailDetails.from?.email || "unknown",
          from: emailDetails.from ? JSON.stringify(emailDetails.from) : null,
          to: emailDetails.to ? JSON.stringify(emailDetails.to) : null,
          cc: emailDetails.cc ? JSON.stringify(emailDetails.cc) : null,
          bcc: emailDetails.bcc ? JSON.stringify(emailDetails.bcc) : null,
          subject: emailDetails.subject,
          body: emailDetails.body,
          mimeType: emailDetails.mimeType,
          date: emailDetails.internalDate
            ? new Date(parseInt(emailDetails.internalDate))
            : null,
          isRead: emailDetails.isRead,
        });
      }

      return true;
    } catch (error) {
      console.error("Error saving email to database:", error);
      return false;
    }
  });
}
