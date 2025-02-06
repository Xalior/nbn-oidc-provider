export default (app) => {
    app.get('/register', async (req, res, next) => {
        try {
            return res.render('register', {
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