import {nanoid} from 'nanoid';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import config from '../../data/config.js'
import bcrypt from 'bcrypt';

export const generateAccountId = ()=>{
    return nanoid(16)
}

const PASSWORD_SALT = config.password.salt;

export const hashAccountPassword = async (password)=>{
    try {
        const salt = await bcrypt.genSalt(PASSWORD_SALT);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        console.log(error);
        throw new Error('Error hashing password');
    }
}

export class Account {
    constructor(id, profile) {
        if(id) {
            console.log("ACCOUNT", id);
        }
        this.accountId = id || nanoid();
        this.profile = profile;
    }

    /**
     * @param use - can either be "id_token" or "userinfo", depending on
     *   where the specific claims are intended to be put in.
     * @param scope - the intended scope, while oidc-provider will mask
     *   claims depending on the scope automatically you might want to skip
     *   loading some claims from external resources etc. based on this detail
     *   or not return them in id tokens but only userinfo and so on.
     */
    async claims(use, scope) { // eslint-disable-line no-unused-vars
        const user = (await db.select()
            .from(users)
            .where(eq(users.account_id, this.accountId))
            .limit(1))[0];

        return {
            sub: this.accountId,
            email: user.email,
            email_verified: user.email_verified,
            family_name: user.family_name,
            given_name: user.given_name,
            locale: user.locale,
            name: user.name,
        };
    }

    static async findByLogin(req) {
        const email = req.body.login;
        const password = req.body.password;

        const user = (await db.select()
            .from(users)
            .where(and
                (
                    eq(users.email, email),
                    eq(users.verified, true),
                    eq(users.suspended, false),
                )
            )
            .limit(1))[0];

        // User not found
        if(!user) {
            req.flash('error', 'Login failed, try again.<br> Or maybe you <a href="/lost_password">forgot your password</a>?');

            return null;
        }

        // User not found
        if(user.login_attempts>2) {
            req.flash('error', 'Account Locked.<br> <a href="/lost_password">Reset your password</a> to continue.');

            return null;
        }

        // Password wrong?
        if (!(await bcrypt.compare(password, user.password))) {
            await db.update(users).set({
                login_attempts: user.login_attempts+1,
            }).where(eq(users.id, user.id));

            req.flash('error', 'Login failed, try again.<br> Or maybe you <a href="/lost_password">lost your password</a>?');

            return null;
        }

        // If the user has failed to login before, reset that to zero now
        if(user.login_attempts>0) {
            await db.update(users).set({
                login_attempts: 0,
            }).where(eq(users.id, user.id));
        }

        return new Account(user.account_id, {
            email: user.email,
            display_name: user.display_name,
            user: user,
        });
    }

    static async findAccount(ctx, id, token) { // eslint-disable-line no-unused-vars
        // token is a reference to the token used for which a given account is being loaded,
        //   it is undefined in scenarios where account claims are returned from authorization endpoint
        // ctx is the http request context

        const user = (await db.select()
            .from(users)
            .where(eq(users.account_id, id))
            .limit(1))[0];

        if (!user) {
            return null; // maintain existing behavior for OIDC
        }

        return new Account(user.account_id, {
            email: user.email,
            display_name: user.display_name,
            user: user,
        });
    }
}

export const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.destination_path = req.route.path;
    res.redirect('/login') // if not auth
};

export const forwardAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/profile');  // if auth
}
