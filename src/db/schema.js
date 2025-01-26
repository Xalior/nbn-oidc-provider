import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import {sql} from "drizzle-orm";
import {nanoid} from "nanoid";

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Should store hashed passwords only
  email_verified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  // update_at: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const signups = sqliteTable('signups', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  invite_code: text('invite_code').notNull().unique().default(sql`(${nanoid(32)})`),
  send_count: integer('count').notNull().default(1),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
})
