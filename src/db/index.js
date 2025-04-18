import { drizzle } from "drizzle-orm/mysql2";
import config from '../../data/config.js';

export const db = drizzle(config.database_url);

// export const db = drizzle(createClient({
//     url: config.database_url
// }));