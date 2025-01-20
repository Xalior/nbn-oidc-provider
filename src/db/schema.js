import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Should store hashed passwords only
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  family_name: text('family_name'),
  given_name: text('given_name'),
  locale: text('locale'),
  name: text('name'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});