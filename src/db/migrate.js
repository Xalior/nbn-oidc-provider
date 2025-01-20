import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db'
});

const db = drizzle(client);

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
}); 