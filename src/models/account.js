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

const ADAPTER_DEBUG = true;

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
        if(ADAPTER_DEBUG) console.debug(`claims {\n\tuse:${use},\n\tscope:${scope}\n\tthis:`,this,`\n}`);

        const user = await db.select()
            .from(users)
            .where(eq(users.account_id, this.accountId))
            .limit(1)
            .get();

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

    static async findByLogin(email, password) {
        if(ADAPTER_DEBUG) console.debug("findByLogin", email);

        const user = await db.select()
            .from(users)
            .where(and
                (
                    eq(users.email, email),
                    eq(users.verified, true),
                    eq(users.suspended, false),
                )
            )
            .limit(1)
            .get();

        // User not found
        if(!user) return null;

        // Password wrong?
        if (!bcrypt.compare(password, user.password)) {
            await db.update(users).set({
                login_attempts: user.constructor+1,
            }).where(eq(users.id, user.id));

            return null;
        }

        return new Account(user.account_id, {
            email: user.email,
            email_verified: user.email_verified,
            family_name: user.family_name,
            given_name: user.given_name,
            locale: user.locale,
            name: user.name,
        });
    }

    static async findAccount(ctx, id, token) { // eslint-disable-line no-unused-vars
        if(ADAPTER_DEBUG) console.debug("findAccount", id, "token=",token);
        // token is a reference to the token used for which a given account is being loaded,
        //   it is undefined in scenarios where account claims are returned from authorization endpoint
        // ctx is the http request context

        const user = await db.select()
            .from(users)
            .where(eq(users.account_id, id))
            .limit(1)
            .get();

        if (!user) {
            return null; // maintain existing behavior for OIDC
        }

        return new Account(user.account_id, {
            email: user.email,
            email_verified: user.email_verified,
            family_name: user.family_name,
            given_name: user.given_name,
            locale: user.locale,
            name: user.name,
        });
    }
}

export const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    req.session.destination_path = req.route.path;
    res.redirect('/login') // if not auth
};

export const forwardAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next()
    }
    res.redirect('/profile');  // if auth
}
