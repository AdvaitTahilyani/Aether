import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { app } from "electron";
import { chmodSync, existsSync, mkdirSync } from "fs";
import { threads, emails, drafts, actions } from "./schema";
import path from "path";

// Determine the database path based on the environment
const isDevelopment = process.env.NODE_ENV === "development";
const devDbPath = path.join(__dirname, "rift-cache.db"); // Places db in the same folder as this file
const prodDbPath = path.join(app.getPath("userData"), "rift-cache.db"); // Places db in the app's user data folder

// Use devDbPath for now (swap to prodDbPath later)
const dbPath = devDbPath;

// Ensure the directory exists (though not needed for dev if dbPath is in the current folder)
const dbDir = path.dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize the SQLite database
const sqlite = new Database(dbPath);

// Restrict permissions
try {
  chmodSync(dbPath, 0o600); // Owner-only read/write
} catch (e) {
  console.error("Failed to set DB permissions:", e);
}

// Initialize Drizzle
export const db = drizzle(sqlite, {
  schema: { threads, emails, drafts, actions },
});

// Run migrations on first run
export function initDb() {
  try {
    migrate(db, { migrationsFolder: "./electron/database/migrations" });
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error; // Or handle it gracefully
  }
}
