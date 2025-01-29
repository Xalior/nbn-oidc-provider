/* eslint-disable no-console, camelcase, no-unused-vars */
export default (app, db) => {
    app.get('/', async (req, res) => {
        return res.render('home', {
            user: req.user,
            errors: req.flash('error'),
        });
    });
};