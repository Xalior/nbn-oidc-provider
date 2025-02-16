import { check, validationResult, matchedData } from 'express-validator';
import { users, confirmation_codes } from '../db/schema.js';
import { db } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import {sendPasswordResetEmail} from "../lib/email.js";
import {nanoid} from "nanoid";

export default (app) => {

    app.get('/reset_password', async (req, res, next) => {
        try {
            const query_string = req.url.replace(/^\/reset_password\?/, '');

            return res.render('reset_password', {
                query_string: query_string
            });
        } catch (err) {
            next(err);
        }
    });

    app.post('/reset_password',
        check('email').trim().notEmpty().isEmail().withMessage('Not a valid e-mail address'),

        check('password_1').trim().notEmpty().isStrongPassword({
            minLength: 16,
            minLowercase: 2,
            minUppercase: 2,
            minNumbers: 2,
            minSymbols: 0,
        }).withMessage('Strong password required (Min. length 16 characters long and must containing at-least 2 uppercase, 2 lowercase and 2 numeric characters.'),

        check('password_2').trim().custom((value,{req, loc, path}) => {
            if (value !== req.body.password_1) {
                // throw error if passwords do not match
                throw new Error("Passwords don't match");
            } else {
                return value;
            }
        }).trim(),

        async (req, res, next) => {
            try {
                const query_string = req.url.replace(/^\/reset_password\?/, '');

                const validation_errors = validationResult(req)?.errors;

                if(validation_errors.length) {
                    console.error(validation_errors);
                    req.body.errors = [];

                    validation_errors.forEach((error) => {
                        req.body.errors[error.path] = error.msg;
                    })

                    req.body.confirmation_code = query_string;

                    return res.render('reset_password', {
                        reset_form: req.body,
                    });
                }

                const age_limit = new Date(Date.now() - (60*30));

                // Search for a confirmation code that matches the raw query string
                const confirmation_code = await db.select()
                    .from(confirmation_codes)
                    .innerJoin(users, eq(confirmation_codes.user_id, users.id,))
                    .where(
                        eq(confirmation_codes.confirmation_code, query_string)
                    )
                    // .limit(1)
                    .get();

                // If we found it, mark the user as confirmed, and redir to login
                if(confirmation_code) {
                    console.log(confirmation_code);
                }

                return res.render('reset_password');
            } catch (err) {
                next(err);
            }
    });

};