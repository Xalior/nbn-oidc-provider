import {ensureAuthenticated} from "../models/account.js";
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export default (app) => {
    app.get('/profile', ensureAuthenticated, async (req, res) => {
        return res.render('profile');
    });

    app.post('/profile', ensureAuthenticated, async (req, res) => {
        try {
            const { display_name } = req.body;

            // Validate display_name
            if (!display_name || display_name.trim() === '') {
                req.flash('error', 'Display name cannot be empty');
                return res.redirect('/profile');
            }

            // Update the user's display_name in the database
            const results = await db.update(users)
                .set({ display_name: display_name.trim() })
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
