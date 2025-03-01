import {ensureAuthenticated} from "../models/account.js";

export default (app) => {
    app.get('/profile', ensureAuthenticated, async (req, res) => {
        return res.render('profile');
    });
};