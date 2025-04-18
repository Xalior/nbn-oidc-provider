import { migrate } from 'drizzle-orm/mysql2/migrator';
import { drizzle } from "drizzle-orm/mysql2";
import config from '../../data/config.js';

async function main() {
  try {
    // Create a database connection using the configuration
    const db = drizzle(config.database_url);

    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log("Migrations completed successfully");
    process.exit(0);
  } catch (err) {
    // Check if the error is because tables already exist
    if (err.message && (
        err.message.includes("already exists") || 
        err.message.includes("Duplicate table") ||
        err.message.includes("Table") && err.message.includes("already exists")
      )) {
      console.log("Tables already exist, skipping migrations");
      process.exit(0);
    } else {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  }
}

main();
