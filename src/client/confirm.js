import { check, validationResult, matchedData } from 'express-validator';
import { users, confirmation_codes } from '../db/schema.js';
import { db } from "../db/index.js";
import { eq, sql } from "drizzle-orm";
import { sendConfirmationEmail} from "../lib/email.js";
import {nanoid} from "nanoid";

export default (app) => {
    app.get('/confirm', async (req, res, next) => {
        try {
            return res.render('confirm', {
                // session: session ? debug(session) : undefined,
                // dbg: {
                //     params: debug(params),
                //     prompt: debug(prompt),
                //     res: debug(res),
                // },
                errors: req.flash('error'),
            });
        } catch (err) {
            next(err);
        }
    });
};