import session from "express-session";

export default (app) => {
    app.get('/', async (req, res) => {

        if(req.user && req.session.destination_path) {
            const destinationPath = req.session.destination_path;
            delete(req.session.destination_path);
            return res.redirect(destinationPath);
        }
        return res.render('home');
    });
};