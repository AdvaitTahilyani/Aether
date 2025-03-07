import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./electron/database/schema.ts", // Path to your schema
  out: "./electron/database/migrations", // Where migrations are stored
  dialect: "sqlite",
  dbCredentials: {
    // For development: use a path relative to the project folder
    url: path.join(__dirname, "rift-cache.db"),
    // For production (commented out): switch to appData path
    // url: `${process.env.HOME}/Library/Application Support/rift-client/rift-cache.db`, // macOS path
  },
});
