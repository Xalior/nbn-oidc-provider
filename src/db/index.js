import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import config from '../../config.js';

export const db = drizzle(createClient({
    url: config.database_url
}));