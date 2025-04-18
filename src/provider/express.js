/* eslint-disable no-console, camelcase, no-unused-vars */
import { strict as assert } from 'node:assert';
import * as querystring from 'node:querystring';
import { inspect } from 'node:util';

import isEmpty from 'lodash/isEmpty.js';
import { urlencoded } from 'express';

import DatabaseAdapter from "../database_adapter.js";

import { Account } from '../models/account.js';
import { errors } from 'oidc-provider';
import {sendLoginPinEmail} from "../lib/email.js";
import {check, matchedData} from "express-validator";
import {db} from "../db/index.js";
import {users} from "../db/schema.js";
import {eq} from "drizzle-orm";

const body = urlencoded({ extended: false });

const keys = new Set();

const debug = (obj) => querystring.stringify(Object.entries(obj).reduce((acc, [key, value]) => {
    keys.add(key);
    if (isEmpty(value)) return acc;
    acc[key] = inspect(value, { depth: null });
    return acc;
}, {}), '<br/>', ': ', {
    encodeURIComponent(value) { return keys.has(value) ? `<strong>${value}</strong>` : value; },
});

const { SessionNotFound } = errors;

const setNoCache = (req, res, next) => {
    res.set('cache-control', 'no-store');
    next();
}

const mfaCode = new DatabaseAdapter("MFACode");

export default (app, provider) => {
    app.get('/interaction/:uid', setNoCache, async (req, res, next) => {
        try {
            const {
                uid, prompt, params, session,
            } = await provider.interactionDetails(req, res);

            const client = await provider.Client.find(params.client_id);

            prompt.details = [ prompt.details.missingOIDCScope, prompt.details.missingOIDCClaims,
                prompt.details.missingResourceScopes, prompt.details.rar].filter(Boolean).length === 0;

            const missingOIDCScope = new Set(prompt.details.missingOIDCScope || []);
            missingOIDCScope.delete('openid');
            missingOIDCScope.delete('offline_access');
            const filteredMissingOIDCScope = Array.from(missingOIDCScope);

            const missingOIDCClaims = new Set(prompt.details.missingOIDCClaims || []);
            ['sub', 'sid', 'auth_time', 'acr', 'amr', 'iss'].forEach((claim) => missingOIDCClaims.delete(claim));
            const filteredMissingOIDCClaims = Array.from(missingOIDCClaims);

            const missingResourceScopes = prompt.details.missingResourceScopes || {};
            const eachMissingResourceScope = Object.entries(missingResourceScopes).map(([indicator, scopes]) => ({
                indicator,
                scopes,
            }));

            // const rar = prompt.details.rar || [];
            // const processedRar = rar.map(({ type, ...detail }) => ({
            //     jsonString: JSON.stringify({ type, ...detail }, null, 4),
            // }));
            //
            // const isOfflineAccessRequested = params.scope && params.scope.includes('offline_access');
            // const hasPreviouslyGrantedOfflineAccess =
            //     !prompt.details.missingOIDCScope || !prompt.details.missingOIDCScope.includes('offline_access');

            console.log("Login Form Session: ", req.session);

            // console.log(req.csrfToken());
            switch (prompt.name) {
                case 'login': {
                    return res.render('login', {
                        client,
                        uid,
                        details: prompt.details,
                        params,
                        title: 'Sign-in',
                        session: session ? debug(session) : undefined,
                        dbg: {
                            params: debug(params),
                            prompt: debug(prompt),
                            res: debug(res),
                        },
                    });
                }

                // We are a "closed circuit" network, with locked down clients and providers - so consent is implied - we should never end up here...
                case 'consent': {
                //     return res.render('interaction', {
                //         client,
                //         uid,
                //         details: prompt.details,
                //         filteredMissingOIDCScope: filteredMissingOIDCScope,
                //         filteredMissingOIDCClaims: filteredMissingOIDCClaims,
                //         eachMissingResourceScope: eachMissingResourceScope,
                //         processedRar: processedRar,
                //         isOfflineAccessRequested: isOfflineAccessRequested,
                //         hasPreviouslyGrantedOfflineAccess: hasPreviouslyGrantedOfflineAccess,
                //         params,
                //         title: 'Authorize',
                //         session: session ? debug(session) : undefined,
                //         dbg: {
                //             params: debug(params),
                //             prompt: debug(prompt),
                //             res: debug(res),
                //         },
                //     });
                    // 'throw'ing will generate a log, and give a 500 error - best we can do in this circumstance
                    throw(new Error(`Unexpected consent request (filteredMissingOIDCScope:${filteredMissingOIDCScope} eachMissingResourceScope:${eachMissingResourceScope} filteredMissingOIDCClaims:${filteredMissingOIDCClaims})`));
                }

                default:
                    return undefined;
            }
        } catch (err) {
            return next(err);
        }
    });

    app.post('/interaction/:uid/login', setNoCache, body, async (req, res, next) => {
        try {
            const details = await provider.interactionDetails(req, res);

            assert.equal(details.prompt['name'], 'login');

            const account = await Account.findByLogin(req);

            if(!account) {
                return res.redirect(`/interaction/${details.jti}`);
            }

            const mfa_pin = ('000000'+Math.floor(Math.random() * 1000000)).slice(-6);
            const request_time = new Date().toJSON();
            await mfaCode.upsert(req.param("uid"), {
                pin: mfa_pin,
                accountId: account.accountId,
                requestTime: request_time
            },15*60);

            await sendLoginPinEmail(req, req.body.login, mfa_pin, request_time);

            return res.render('mfa', {
                'uid': req.param("uid"),
            });

        } catch (err) {
            next(err);
        }
    });

    app.post('/interaction/:uid/mfa', setNoCache, body,
        // Validation
        check('mfa').trim().notEmpty().isNumeric().isLength({
            min: 6,
            max: 6,
        }).withMessage('Invalid MFA PIN.'),

        // Actual Page Handler
        async (req, res, next) => {
        try {
            const details = await provider.interactionDetails(req, res);

            assert.equal(details.prompt['name'], 'login');

            const mfa_form = matchedData(req, { includeOptionals: true });

            const mfa_code = await mfaCode.find(req.param("uid"));

            const account = await Account.findAccount(null, mfa_code?.accountId);

            if(!account) {
                await db.update(users).set({
                    login_attempts: account.profile.user.login_attempts+1,
                }).where(eq(users.id, account.profile.user.id));

                req.flash('error', 'Unexpected MFA association!');

                return res.redirect(`/interaction/${details.jti}`);
            }

            console.log("Form, MFA & Account: ", mfa_form, mfa_code, account);

            // User Locked
            if(account.profile.user.login_attempts>2) {
                req.flash('error', 'Account Locked.<br> <a href="/lost_password">Reset your password</a> to continue.');

                return res.redirect(`/interaction/${details.jti}`);
            }

            if(mfa_form.mfa !== mfa_code.pin) {
                await db.update(users).set({
                    login_attempts: account.profile.user.login_attempts+1,
                }).where(eq(users.id, account.profile.user.id));

                req.flash('error', 'Invalid Passcode!');

                return res.render('mfa', {
                    'uid': req.param("uid"),
                });

            }

            mfaCode.destroy(account.accountId);

            const result = {
                login: {
                    accountId: account.accountId,
                },
            };

            // Successful login == reset login_attempts
            if(account.profile.user.login_attempts>0) {
                await db.update(users).set({
                    login_attempts: account.profile.user.login_attempts + 1,
                }).where(eq(users.id, account.profile.user.id));
            }

            console.log("MFA Complete: ", req.session);
            await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        } catch (err) {
            next(err);
        }
    });


    // app.post('/interaction/:uid/confirm', setNoCache, body, async (req, res, next) => {
    //     try {
    //         const interactionDetails = await provider.interactionDetails(req, res);
    //         const { prompt: { name, details }, params, session: { accountId } } = interactionDetails;
    //         assert.equal(name, 'consent');
    //
    //         let { grantId } = interactionDetails;
    //         let grant;
    //
    //         if (grantId) {
    //             // we'll be modifying existing grant in existing session
    //             grant = await provider.Grant.find(grantId);
    //         } else {
    //             // we're establishing a new grant
    //             grant = new provider.Grant({
    //                 accountId,
    //                 clientId: params.client_id,
    //             });
    //         }
    //
    //         if (details.missingOIDCScope) {
    //             grant.addOIDCScope(details.missingOIDCScope.join(' '));
    //         }
    //         if (details.missingOIDCClaims) {
    //             grant.addOIDCClaims(details.missingOIDCClaims);
    //         }
    //         if (details.missingResourceScopes) {
    //             for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
    //                 grant.addResourceScope(indicator, scopes.join(' '));
    //             }
    //         }
    //
    //         grantId = await grant.save();
    //
    //         const consent = {};
    //         if (!interactionDetails.grantId) {
    //             // we don't have to pass grantId to consent, we're just modifying existing one
    //             consent.grantId = grantId;
    //         }
    //
    //         const result = { consent };
    //         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    //     } catch (err) {
    //         next(err);
    //     }
    // });

    app.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
        try {
            // const details = await provider.interactionDetails(req, res);
            // const client = await provider.Client.find(details.params.client_id);
            const result = {
                error: 'access_denied',
                error_description: 'End-User aborted interaction',
            };


            await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });

        } catch (err) {
            next(err);
        }
    });

    app.use((err, req, res, next) => {
        if (err instanceof SessionNotFound) {
            req.flash('error', 'Session expired - please log in again&hellip;');
            return res.redirect('/login');
            // throw SessionNotFound;
            // handle interaction expired / session not found error
        }
        next(err);
    });
};
