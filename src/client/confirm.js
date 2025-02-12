import { check, validationResult, matchedData } from 'express-validator';
import { users, confirmation_codes } from '../db/schema.js';
import { db } from "../db/index.js";
import { eq, and, gte } from "drizzle-orm";
import { sendConfirmationEmail} from "../lib/email.js";
import {nanoid} from "nanoid";

export default (app) => {
    app.get('/confirm', async (req, res, next) => {
        try {
            const age_limit = new Date(Date.now() - (60*30));
            const query_string = req.url.replace(/^\/confirm\?/, '');

            const confirmation_code = await db.select()
                .from(confirmation_codes)
                .where(and(
                    eq(confirmation_codes.invite_code, query_string),
                    gte(confirmation_codes.created_at, age_limit)
                ))
                .limit(1)
                .get();

            if(confirmation_code) {
                console.log(age_limit.getTime());
                console.log("confirmation_code:",confirmation_code);
                await db.update(users).set({
                    verified: true,
                    confirmed_at: new Date(Date.now()),
                }).where(eq(users.id, confirmation_code.user_id));

                req.flash('info', 'Account confirmed - please login to continue');

                return res.redirect("/login");
            }

            return res.render('confirm', {
                // session: session ? debug(session) : undefined,
                // dbg: {
                //     params: debug(params),
                //     prompt: debug(prompt),
                //     res: debug(res),
                // },
            });
        } catch (err) {
            next(err);
        }
    });
};