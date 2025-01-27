/* eslint-disable no-console */
import * as path from 'node:path';
import * as url from 'node:url';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import flash from 'connect-flash';
import helmet from 'helmet';
import { dirname } from 'desm';
import mustacheExpress from 'mustache-express';
import Provider from 'oidc-provider';
import Account from './support/account.js';
import config from '../config.js';
import routes from './routes/express.js';
import morgan from 'morgan';

import * as openidClient from 'openid-client'
import passport from 'passport';
import { Strategy } from 'openid-client/passport'
import * as RotatingFileStream from "rotating-file-stream";
import { ensureLoggedIn, ensureLoggedOut } from 'connect-ensure-login'

const __dirname = dirname(import.meta.url);

const { PORT = 3000, ISSUER = `https://localhost:${PORT}` } = process.env;

// Set up account finder
config.findAccount = Account.findAccount;

// Initialize Express app
const app = express();

// create a rotating write stream
const accessLogStream = RotatingFileStream.createStream('access.log', {
    interval: '1d', // rotate daily
    path: path.join(__dirname, 'log')
})

// setup the logger
app.use(morgan('combined'));//, { stream: accessLogStream }))

app.use(cookieParser('nbn-id-dev'));

app.use(session({
    secret: 'nbn-id-dev',
    resave: true,
    saveUninitialized: true
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

const provider_url_string = "https://dev.id.nextbestnetwork.com/";
const client_id = "SELF";
const client_secret = "SELF_SECRET";

let server, issuer;

const provider_url = new URL(provider_url_string);

app.get('/', ensureLoggedIn('/login'),
    async (req, res) => {
        let me;

        console.log("Current Tokens:", claims[req.user.sub]);
        try {
            me = await openidClient.fetchUserInfo(issuer, claims[req.user.sub].access_token, req.user.sub);
        } catch (WWWAuthenticateChallengeError) {
            console.log("Attempting to refresh token:");
            const tokens = await openidClient.refreshTokenGrant(issuer, claims[req.user.sub].refresh_token, {
                scope: 'openid email'
            });

            if(!tokens) res.redirect('/login');

            console.log("New Tokens:", tokens);

            me = await openidClient.fetchUserInfo(issuer, tokens.access_token, req.user.sub);

            claims[req.user.sub] = {
                access_token: tokens.access_token,
                id_token: tokens.id_token,
                token_type: tokens.token_type,
                scope: tokens.scope,
                expires_in: tokens.expires_in,
                refresh_token: tokens.refresh_token,
                me: me
            };

            console.log("New me:", me);
        }

        console.log("Me: ", me);
        res.send(`Welcome ${req.user?.email || req.user?.sub} - ${me.email}`);
    }
);

app.get('/login',
    passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true
    })
);

app.get('/callback', passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true
    }),

    // Executed on successful login
    function(req, res) {
        console.log("Callback URL triggered");
        console.log(req.user);
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
    const provider = new Provider("https://dev.id.nextbestnetwork.com/", { adapter, ...config });

    // If in production, enforce HTTPS by redirecting requests
    if (config.mode === 'production' || config.force_https === true) {
        app.enable('trust proxy');
        provider.proxy = true;

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

    // Configure routes and middleware
    routes(app, provider);
    app.use(provider.callback());

    // Start the server
    server = app.listen(PORT, () => {
        console.log(`Application is listening on port ${PORT}`);
        console.log(`Check /.well-known/openid-configuration for details.`);
    });

    console.log("Being period of self discovery: ", provider_url_string);

    issuer = await openidClient.discovery(
        provider_url,
        client_id,
        client_secret,
    );

    console.log('Discovered issuer %s %O', issuer.issuer, issuer.metadata, issuer);

    passport.use(new Strategy({
        'config': issuer,
        'scope': 'openid email userinfo offline_access',
        'callbackURL': `${provider_url}callback`
    }, async (tokens, verified) => {
            console.log("Verifying tokens: ", tokens);
            const this_claim = tokens.claims();

            const me = await openidClient.fetchUserInfo(issuer, tokens.access_token, this_claim.sub);

            console.log(me);

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


} catch (err) {
    // Gracefully handle errors
    if (server?.listening) server.close();
    console.error('Error occurred:', err);
    process.exitCode = 1;
}