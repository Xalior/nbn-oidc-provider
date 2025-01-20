/* eslint-disable no-console */
import * as path from 'node:path';
import * as url from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { dirname } from 'desm';
import mustacheExpress from 'mustache-express';

import Provider from 'oidc-provider';
import Account from './support/account.js';
import config from '../config.js';
import routes from './routes/express.js';

const __dirname = dirname(import.meta.url);

const { PORT = 3000, ISSUER = `https://localhost:${PORT}` } = process.env;

// Set up account finder
config.findAccount = Account.findAccount;

// Initialize Express app
const app = express();

// FUCK CORS
app.use(cors());

// Set up Helmet for security - Remove "form-action" directive
const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
delete directives['form-action'];
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives,
    },
}));


// Register `.mustache` as the template engine
app.engine('mustache', mustacheExpress());

// Configure app views and template engine
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

let server;

try {
    // Initialize database adapter if MongoDB URI is provided
    let adapter;
    if (process.env.MONGODB_URI) {
        ({ default: adapter } = await import('./adapters/mongodb.js'));
        await adapter.connect();
    }

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
} catch (err) {
    // Gracefully handle errors
    if (server?.listening) server.close();
    console.error('Error occurred:', err);
    process.exitCode = 1;
}