/* eslint-disable no-console */
import * as path from 'node:path';
import * as url from 'node:url';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import helmet from 'helmet';
import { dirname } from 'desm';
import mustacheExpress from 'mustache-express';
import Provider from 'oidc-provider';
import { Account } from './support/account.js';
import config from '../data/config.js';
import * as log from './lib/log.js';
import provider_routes from './provider/express.js';
import client_routes from './client/routes.js';
import morgan from 'morgan';
import bodyParser from "body-parser";
import slugify from "slugify";

import * as openidClient from 'openid-client'
import passport from 'passport';
import { Strategy } from 'openid-client/passport'

const __dirname = dirname(import.meta.url);

const { PORT = 3000, ISSUER = `https://localhost:${PORT}` } = process.env;

// Set up account finder
config.findAccount = Account.findAccount;

// Initialize Express app
const app = express();

// setup the logger
app.use(morgan('combined', { stream: log.logstream }))

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'nbn-id-dev',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true
    }
}));

app.use(flash());

// FUCK CORS
app.use(cors());
console.log(path.join(__dirname, '../public'));

app.use('/static', express.static(path.join(__dirname, '../public')));

// Set up Helmet for security - Remove "form-action" directive
const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
delete directives['form-action'];
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives,
    },
}));

app.use(passport.authenticate('session'))

// Register `.mustache` as the template engine
app.engine('mustache', mustacheExpress());

// Configure app views and template engine
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    const orig = res.render;

    //  Before we dispatch to our renderer, inject our constant requirements
    res.render = (view, locals) => {
        if(!locals) locals = {};

        if(['login'].includes(view)) locals.hide_header = true;

        app.render(view, locals, (err, html) => {
            if (err) throw err;
            orig.call(res, '_layout', {
                ...locals,
                user: req.user,
                body: html,

                errors: req.flash('error'),
                infos: req.flash('info'),
                warnings: req.flash('warning'),
                successes: req.flash('success'),

            });
        });
    };

    next();
});

const client_id = "SELF";
const client_secret = "SELF_SECRET";

let server, issuer;

const provider_url = new URL(config.provider_url);

client_routes(app);

app.get('/login',
    passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true,
        keepSessionInfo: true
    })
);

app.get('/docs/:path',
    function(req, res, next) {
        try{
            const path = slugify(req.params.path);
            return res.render(path);
        } catch (err) {
            return res.status(404).send("Not Found");
        }
    }
);

app.get('/callback',
    passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true,
        keepSessionInfo: true
    }),

    // Executed on successful login
    function(req, res) {
        // console.log("Callback URL triggered");
        // console.log(req.user, req.session);
        res.redirect('/');
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect(
            openidClient.buildEndSessionUrl(issuer, {
                post_logout_redirect_uri: `${req.protocol}://${req.host}`,
            }).href,
        )
    })
})

passport.serializeUser((user, cb) => {
    cb(null, user)
})

passport.deserializeUser((user, cb) => {
    return cb(null, user)
})

let claims = [];

try {
    // Initialize database adapter if MongoDB URI is provided
    let adapter;
    ({ default: adapter } = await import('./nbn_adapter.js'));

    // Set up the OIDC Provider
    const provider = new Provider(config.provider_url, { adapter, ...config });

    // If in production, enforce HTTPS by redirecting requests
    if (config.mode === 'production' || config.force_https === true) {
        app.enable('trust proxy');
        provider.proxy = true;

        provider.addListener('server_error', (etx, error) => {
            console.log(etx, error);
            console.error(JSON.stringify(error, null, 2));
        });

        app.use((req, res, next) => {
            if (req.secure) {
                next();
            } else if (['GET', 'HEAD'].includes(req.method)) {
                res.redirect(url.format({
                    protocol: 'https',
                    host: req.get('host'),
                    pathname: req.originalUrl,
                }));
            } else {
                res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'Please use HTTPS for secure communication.',
                });
            }
        });
    }

    // Configure provider routes and middleware
    provider_routes(app, provider);
    app.use(provider.callback());

    // Start the server
    server = app.listen(PORT, () => {
        console.info(`Application is listening on port ${PORT}`);
        console.info(`Check /.well-known/openid-configuration for details.`);
    });

    console.info("Being period of self discovery: ", config.provider_url);

    issuer = await openidClient.discovery(
        provider_url,
        client_id,
        client_secret,
    );

    console.log('Discovered issuer:', issuer.serverMetadata());

    passport.use(new Strategy({
        'config': issuer,
        'scope': 'openid email userinfo offline_access',
        'callbackURL': `${provider_url}callback`
    }, async (tokens, verified) => {
            const this_claim = tokens.claims();

            const me = await openidClient.fetchUserInfo(issuer, tokens.access_token, this_claim.sub);
            console.log("openidClient.fetchUserInfo", me);

            claims[this_claim.sub] = {
                access_token: tokens.access_token,
                id_token: tokens.id_token,
                token_type: tokens.token_type,
                scope: tokens.scope,
                expires_in: tokens.expires_in,
                refresh_token: tokens.refresh_token,
                me: me
            };

            verified(null, this_claim);
        }
    ));

    // Error handling function(s) must be registered last...
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).render('error', {});
    })
} catch (err) {
    // Gracefully handle errors
    if (server?.listening) server.close();
    console.error('Error occurred:', err);
    process.exitCode = 1;
}