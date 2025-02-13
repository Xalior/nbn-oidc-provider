export default {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:data/sqlite.db'
  }
}; 
