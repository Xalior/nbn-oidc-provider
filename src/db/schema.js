import { sqliteTable, text, integer,  } from 'drizzle-orm/sqlite-core';
import {sql} from "drizzle-orm";
import {nanoid} from "nanoid";

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  account_id: text('account_id').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Should store hashed passwords only
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  suspended: integer('suspended', { mode: 'boolean' }).notNull().default(false),
  hmac_key: text('hmac_key'),
  display_name: text('display_name').notNull(),
  confirmation_attempts: integer('confirmation_attempts'),
  login_attempts: integer('login_attempts'),
  confirmation_sent: integer('confirmed_at', { mode: 'timestamp' }),
  confirmed_at: text('confirmed_at'),
  created_at: text('created_at').notNull().default(sql`(current_timestamp)`),
});

export const confirmation_codes = sqliteTable('confirmation_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  confirmation_code: text('confirmation_code').notNull().unique(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  created_at: text('created_at').notNull().default(sql`(current_timestamp)`),
});
