import { users, confirmation_codes } from '../db/schema.js';
import { db } from "../db/index.js";
import { eq, and, gte } from "drizzle-orm";

export default (app) => {
    app.get('/confirm', async (req, res, next) => {
        try {
            const age_limit = new Date(Date.now() - (60*30));
            const query_string = req.url.replace(/^\/confirm\?/, '');

            // Search for a confirmation code that matches the raw query string
            const confirmation_code = await db.select()
            .from(confirmation_codes)
            .where(and(
                eq(confirmation_codes.confirmation_code, query_string)
            ))
            .limit(1)
            .get();

            // If we found it, mark the user as confirmed, and redir to login
            if(confirmation_code) {
                // Check for expired codes here, and handle accordingly
                //                     gte(confirmation_codes.created_at, age_limit)
                // removed from above query, so we can handle error messages instead
                await db.update(users).set({
                    verified: true,
                    confirmed_at: new Date(Date.now()),
                }).where(eq(users.id, confirmation_code.user_id));

                req.flash('info', 'Account confirmed - please login to continue');

                return res.redirect("/login");
            }

            // SHush now, no need to tell them anything...
            return res.render('confirm');
        } catch (err) {
            next(err);
        }
    });
};