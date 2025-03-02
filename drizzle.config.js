import config from './data/config.js';

export default {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: config.database_url
  }
}; 
