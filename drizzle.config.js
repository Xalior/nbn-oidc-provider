export default {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  driver: "libsql",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:sqlite.db'
  }
}; 
