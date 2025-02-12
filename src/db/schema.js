import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import {sql} from "drizzle-orm";
import {nanoid} from "nanoid";

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Should store hashed passwords only
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  suspended: integer('suspended', { mode: 'boolean' }).notNull().default(false),
  hmac_key: text('hmac_key'),
  display_name: text('display_name').notNull(),
  confirmation_attempts: integer('confirmation_attempts'),
  login_attempts: integer('login_attempts'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  confirmation_sent: integer('confirmed_at', { mode: 'timestamp' }),
  confirmed_at: integer('confirmed_at', { mode: 'timestamp' })
});

export const confirmation_codes = sqliteTable('confirmation_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: text('user_id').references(() => users.id),
  invite_code: text('invite_code').notNull().unique(),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
