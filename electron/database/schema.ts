import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(), // Thread ID from Gmail/Graph, or synthetic for IMAP
    account: text("account").notNull(), // e.g., jdoe@illinois.edu
    subject: text("subject"), // Subject of the thread (from first email or latest)
    date: integer("date", { mode: "timestamp_ms" }), // Latest email date in thread
    labels: text("labels"), // JSON array, e.g., '["INBOX", "UNREAD"]'
    historyId: text("historyId"), // Gmail-specific
    changeKey: text("changeKey"), // Graph-specific
  },
  (table) => ({
    threadAccountIdx: index("threadAccount_idx").on(table.account),
    threadDateIdx: index("threadDate_idx").on(table.date),
  })
);

export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey(), // Message ID from provider
    account: text("account").notNull(),
    threadId: text("threadId")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }), // Links to threads
    from: text("from"),
    to: text("to"), // JSON string, e.g., '["jovúane@example.com", "bob@example.com"]'
    cc: text("cc"), // e.g., "alice@example.com"
    bcc: text("bcc"), // e.g., "charlie@example.com"
    subject: text("subject"),
    body: text("body"), // Plain text or HTML content
    mimeType: text("mimeType"), // "text/plain", "text/html"
    date: integer("date", { mode: "timestamp_ms" }),
    isRead: integer("isRead", { mode: "boolean" }).default(false), // 0 = unread, 1 = read
  },
  (table) => ({
    emailsThreadIdIdx: index("emailsThreadId_idx").on(table.threadId),
    emailsDateIdx: index("emailsDate_idx").on(table.date),
  })
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    account: text("account").notNull(),
    to: text("to"), // JSON string, e.g., '["jane@example.com", "bob@example.com"]'
    cc: text("cc"),
    bcc: text("bcc"),
    subject: text("subject"),
    body: text("body"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull(), // can be pending / queued / sent / failed
    error: text("error"), // error message if the action failed
  },
  (table) => ({
    draftsAccountIdx: index("draftsAccount_idx").on(table.account),
    draftsCreatedAtIdx: index("draftsCreatedAt_idx").on(table.createdAt),
  })
);

export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    account: text("account").notNull(),
    objectType: text("objectType").notNull(), // can either be thread / email / draft
    objectId: text("objectId").notNull(),
    action: text("action").notNull(), // can be a lot of different actions based on the object type
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    actionStatus: text("actionStatus").notNull(), // can be pending / queued / sent / failed
    error: text("error"), // error message if the action failed
  },
  (table) => ({
    actionsAccountIdx: index("actionsAccount_idx").on(table.account),
    actionsObjectIdIdx: index("actionsObjectId_idx").on(table.objectId),
  })
);
