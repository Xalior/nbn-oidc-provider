import {ensureAuthenticated} from "../models/account.js";
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { check, validationResult, matchedData } from 'express-validator';

export default (app) => {
    app.get('/profile', ensureAuthenticated, async (req, res) => {
        return res.render('profile');
    });

    app.post('/profile', ensureAuthenticated,
        check('display_name').trim().notEmpty().isLength({
            min: 5,
            max: 64
        }).withMessage("Display name should be between 5 and 64 characters.").escape(),

        async (req, res) => {
        try {
            const validation_errors = validationResult(req)?.errors;

            if(validation_errors.length) {
                validation_errors.forEach((error) => {
                    req.flash('error', error.msg);
                });
                return res.redirect('/profile');
            }

            const profile_form = matchedData(req, { includeOptionals: true });

            // Update the user's display_name in the database
            const results = await db.update(users)
                .set({ display_name: profile_form.display_name })
                .where(eq(users.account_id, req.user.sub));

            req.flash('success', 'Profile updated successfully');
            return res.redirect('/profile');
        } catch (error) {
            console.error('Error updating profile:', error);
            req.flash('error', 'An error occurred while updating your profile');
            return res.redirect('/profile');
        }
    });
};
