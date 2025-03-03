import { check, validationResult, matchedData } from 'express-validator';
import { users, confirmation_codes } from '../db/schema.js';
import { db } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import {sendPasswordResetEmail} from "../lib/email.js";
import {nanoid} from "nanoid";

export default (app) => {
    app.get('/lost_password', async (req, res, next) => {
        try {
            return res.render('lost_password');
        } catch (err) {
            next(err);
        }
    });

    app.post('/lost_password',
        check('email').trim().notEmpty().isEmail().withMessage('Not a valid e-mail address'),

        // Actual page response
        async (req, res, next) => {
            try {
                if(req.body.confirm_spammer === 'on') {
                    req.flash('info', 'If you have a valid account then a password reset link has been emailed to it.');
                    // Redirect to confirmation static page -- the email= slug only logs the email address in the weblog
                    // it's a red herring in a honeypot ;-)  -- but stored lazily so we can maybe report on it later...
                    return res.redirect(`/login?email=${req.body.email}`);
                }

                const validation_errors = validationResult(req)?.errors;
                console.log("validation_errors",validation_errors);
                if(validation_errors.length) {
                    req.body.errors = [];

                    validation_errors.forEach((error) => {
                        req.body.errors[error.path] = error.msg;
                    })

                    console.log("req.body being sent to conf_form", req.body);
                    return res.render('lost_password', {
                        conf_form: req.body
                    });
                }

                const conf_form = matchedData(req, { includeOptionals: true });

                const existing_user = (await db.select()
                    .from(users)
                    .where(and(
                        eq(users.email, conf_form.email),
                        eq(users.verified, 1),
                    ))
                    .limit(1))[0];

                if (existing_user) {
                    const [confirmation_code] = await db.insert(confirmation_codes).values({
                        user_id: existing_user.id,
                        confirmation_code: nanoid(52)
                    }).returning();  //:FIXME - sqlite

                    await sendPasswordResetEmail(existing_user.email, confirmation_code.confirmation_code);
                }

                req.flash('info', 'If you have an account a password reset link has been emailed to your registered email address.');

                // Redirect to login page
                return res.redirect(`/`);
            } catch (err) {
                next(err);
            }
    });
};