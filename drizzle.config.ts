import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./electron/database/schema.ts", // Path to your schema
  out: "./electron/database/migrations", // Where migrations are stored
  dialect: "sqlite",
  dbCredentials: {
    // For development: use a path relative to the project folder
    url: path.join(__dirname, "aether-cache.db"),
    // For production (commented out): switch to appData path
    // url: `${process.env.HOME}/Library/Application Support/aether-client/aether-cache.db`, // macOS path
  },
});
