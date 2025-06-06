import * as path from 'node:path';
import * as url from 'node:url';
import cors from 'cors';
import express, { Request, Response, NextFunction, Application } from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import helmet from 'helmet';
import { dirname } from 'desm';
import mustacheExpress from 'mustache-express';
import Provider from 'oidc-provider';
import { Account, User as AccountUser } from './models/account.js';
import * as log from './lib/log.js';
import provider_routes from './provider/express.js';
import client_routes from './controller/routes.js';
import morgan from 'morgan';
import bodyParser from "body-parser";
import slugify from "slugify";
import csrf from "@dr.pogodin/csurf";

import {config} from './lib/config.js'

import * as openidClient from 'openid-client';
import passport from 'passport';
import { Strategy } from 'openid-client/passport';
import {ClientMetadata} from "openid-client";
import * as http from "node:http";



// Extend Express Request type to include user and flash
declare global {
  namespace Express {
    interface Request {
        // @ts-ignore
      user?: AccountUser;
        // @ts-ignore
      logout: (done: (err: any) => void) => void;
      csrfToken: () => string;
    }
    interface Response {
      locals: {
        csrfToken?: string;
        [key: string]: any;
      };
    }
  }
}

declare module 'express-session' {
    interface SessionData {
        destination_path: string;
        remember_me: boolean;
    }
}

const __dirname = dirname(import.meta.url);

// Set up account finder
config.findAccount = Account.findAccount;

// Initialize Express app
const app: Application = express();

// setup the logger
app.use(morgan('combined', { stream: log.logstream }));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true
    }
}));

// Setup CSRF protection
const csrfProtection = csrf({
    cookie: false,
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
});

// Make CSRF token available to all templates
app.use((req: Request, res: Response, next: NextFunction) => {
    if(req.path.startsWith('/token') ||
        req.path.startsWith('/session/end/confirm')
    ) {
        next();
    } else {
        csrfProtection(req, res, next);
    }
});

// Make CSRF token available to all templates
app.use((req: Request, res: Response, next: NextFunction) => {
    if(!req.path.startsWith('/token')
        && !req.path.startsWith('/session/end/confirm')
    ) {
        res.locals.csrfToken = req.csrfToken();
    }
    next();
});

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

app.use(passport.authenticate('session'));

// Register `.mustache` as the template engine
app.engine('mustache', mustacheExpress());

// Configure app views and template engine
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

const hide_headers: string[] = ['login', 'mfa', 'register'];
interface OIDCUser {
    sub: string
}

app.use((req: Request, res: Response, next: NextFunction) => {
    const orig = res.render;

    //  Before we dispatch to our renderer, inject our constant requirements
    res.render = async (view: string, locals?: Record<string, any>) => {
        locals = locals || {};

        if(req.user) {
            const account = (await Account.findAccount(req, (req.user as OIDCUser).sub)) as Account;
            req.user = account.profile['user'];
        }

        const renderLocals = {
            ...locals,
            errors: req.flash('error'),
            infos: req.flash('info'),
            warnings: req.flash('warning'),
            successes: req.flash('success'),
            user: req.user,
            csrfToken: res.locals.csrfToken,
            hide_header: hide_headers.includes(view)
        };

        app.render(view, renderLocals, (err: Error | null, html?: string) => {
            if (err) throw err;
            if (!html) throw new Error('No HTML rendered');
            orig.call(res, '_layout', {
                ...renderLocals,
                // @ts-ignore - this is the optional, callback, signature - tsEmit is confused by there being multiple ones
                body: html,
            });
        });
    };

    next();
});

const client_id: string = process.env.CLIENT_ID || "SELF";
const client_secret: string = process.env.CLIENT_SECRET || "SELF_SECRET";

let server: http.Server;
// let issuer: openidClient.Issuer<openidClient.Client>;
let issuer: openidClient.Configuration;

const provider_url = new URL(config.provider_url);

client_routes(app);

app.get('/login',
    passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true,
        keepSessionInfo: true
    })
);

app.get('/callback',
    passport.authenticate(provider_url.host, {
        failureRedirect: '/login',
        failureFlash: true,
        keepSessionInfo: true
    }),

    // Executed on successful login
    function(req: Request, res: Response) {
        // console.log("Callback URL triggered");
        // console.log(req.user, req.session);
        res.redirect('/');
    }
);

app.get('/logout', (req: Request, res: Response) => {
    req.logout(() => {
        res.redirect(
            openidClient.buildEndSessionUrl(issuer, {
                post_logout_redirect_uri: `${req.protocol}://${req.get('host')}`,
            }).href,
        );
    });
});

passport.serializeUser((user: any, cb: (err: any, user: any) => void) => {
    cb(null, user);
});

passport.deserializeUser((user: any, cb: (err: any, user: any) => void) => {
    return cb(null, user);
});

try {
    // Initialize database adapter if MongoDB URI is provided
    let adapter: any;
    ({ default: adapter } = await import('./database_adapter.js'));

    // @ts-ignore - Set up the OIDC Provider -- the config is overloaded with some of our own parts
    const provider = new Provider(config.provider_url, { adapter, ...config });

    app.enable('trust proxy');
    provider.proxy = true;

    provider.addListener('server_error', (ctx: any, error: any) => {
        console.log(ctx, error);
        console.error(JSON.stringify(error, null, 2));
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
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

    // Configure provider routes and middleware
    provider_routes(app, provider);

    app.use(provider.callback());

    // Start the server
    server = app.listen(process.env.PORT || 5000, () => {
        console.info(`Application is listening on port ${process.env.PORT || 5000}`);
        console.info(`Check /.well-known/openid-configuration for details.`);
    });

    console.info("Being period of self discovery: ", config.provider_url);

    const asyncTimeout = (ms: number) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    };

    await asyncTimeout(10000);

    issuer = await openidClient.discovery(
        provider_url,
        client_id,
        client_secret,
    );

    console.log('Discovered issuer:', issuer.serverMetadata());

    passport.use(new Strategy({
        'config': issuer,
        'scope': 'openid email',
        'callbackURL': `${provider_url}callback`
    }, async (tokens: any, verified: (err: Error | null, user: any) => void) => {
            const this_claim = tokens.claims();

            const me = await openidClient.fetchUserInfo(issuer, tokens.access_token, this_claim.sub);
            console.log("openidClient.fetchUserInfo: ", me);

            // // At this point, if we want local profile data
            // // we should create it here, if it does not already exist
            // // but we're the controller, so we already have this...
            // claims[this_claim.sub] = {
            //     access_token: tokens.access_token,
            //     id_token: tokens.id_token,
            //     token_type: tokens.token_type,
            //     scope: tokens.scope,
            //     expires_in: tokens.expires_in,
            //     refresh_token: tokens.refresh_token,
            //     me: me
            // };

            // Turn the claim into a passport user object
            verified(null, this_claim);
        }
    ));

    // Error handling function(s) must be registered last...
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
        if (err.code === 'EBADCSRFTOKEN') {
            // Handle CSRF token errors
            console.error(`ERROR: CSRF token validation failed - IP:${req.ip} - ${req.method} ${req.originalUrl} - ${req.body ? JSON.stringify(req.body) : ''}`);
            // Don't use req.flash here as it might not be available
            return res.status(403).render('error', { 
                message: 'Security validation failed. Please try again.' 
            });
        }

        console.error(err);
        res.status(500).render('error', {});
    });
} catch (err) {
    // @ts-ignore - even before the server has started up, maybe... Gracefully handle errors
    if (server?.listening) server.close();
    console.error('Error occurred:', err);
    process.exitCode = 1;
}
