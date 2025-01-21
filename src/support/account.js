import {nanoid} from 'nanoid';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

class Account {
    constructor(id, profile) {
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
        console.log("claims:", use, scope, this);
        // if (this.profile) {
        //     return {
        //         sub: this.accountId, // it is essential to always return a sub claim
        //         email: this.profile.email,
        //         email_verified: this.profile.email_verified,
        //         family_name: this.profile.family_name,
        //         given_name: this.profile.given_name,
        //         locale: this.profile.locale,
        //         name: this.profile.name,
        //     };
        // }

        const user = await db.select()
            .from(users)
            .where(eq(users.id, this.accountId))
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

    static async findByLogin(login) {
        const user = await db.select()
            .from(users)
            .where(eq(users.email, login))
            .get();

        if (!user) {
            return null;
        }

        return new Account(user.id, {
            email: user.email,
            email_verified: user.email_verified,
            family_name: user.family_name,
            given_name: user.given_name,
            locale: user.locale,
            name: user.name,
        });
    }

    static async findAccount(ctx, id, token) { // eslint-disable-line no-unused-vars
        // token is a reference to the token used for which a given account is being loaded,
        //   it is undefined in scenarios where account claims are returned from authorization endpoint
        // ctx is the http request context
        console.log("findAccount(",ctx, id, token,")");
    

        const user = await db.select()
            .from(users)
            .where(eq(users.id, id))
            .get();

        if (!user) {
            return null; // maintain existing behavior for OIDC
        }

        return new Account(user.id, {
            email: user.email,
            email_verified: user.email_verified,
            family_name: user.family_name,
            given_name: user.given_name,
            locale: user.locale,
            name: user.name,
        });
    }
}

export default Account;
