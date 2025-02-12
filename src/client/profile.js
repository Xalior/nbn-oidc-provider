import {ensureAuthenticated} from "../support/account.js";

export default (app) => {
    app.get('/profile', ensureAuthenticated, async (req, res) => {
        return res.render('profile');
    });
};