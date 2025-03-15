import {expect} from '@wdio/globals'
import AuthPage from '../../pageobjects/auth.page.js'
import {db} from "../../../src/db/index.js";
import {confirmation_codes, users} from "../../../src/db/schema.js";
import {and, eq} from "drizzle-orm";
import {hashAccountPassword} from "../../../src/models/account.js";

const admin_email = 'darran@xalior.com';
let admin_password = '123123qweqweASDASD';
const admin_account_id = 1;

describe('Authentication:Lost Password', () => {
    async function init() {
        let res = await db.update(users).set({
            login_attempts: 0,
            password: await hashAccountPassword(admin_password),
        }).where(eq(users.id, admin_account_id));
        console.log("Reset admin 'account':", res[0]['info']);

        res = await db.delete(confirmation_codes).where(eq(confirmation_codes.user_id, admin_account_id));
        console.log("Reset admin 'confirmation_codes':", res[0]['affectedRows']);

    }

    it("00: PREREQS", async () => {
        await init();
    });

    it("01: Can request a password reset...", async () => {
        await AuthPage.lost_password(admin_email);
        await expect(AuthPage.alertInfo).toHaveText(expect.stringContaining('If you have an account'));
    });

    it("01: Can follow lost_password emails...", async () => {
        // Search for a confirmation code that matches the raw query string
        const confirmation_code = (await db.select()
        .from(confirmation_codes)
        .where(
            and(
                eq(confirmation_codes.user_id, 1),
                eq(confirmation_codes.used, false)
            )
        )
        .limit(1))[0];

        await AuthPage.reset_password(confirmation_code.confirmation_code, admin_email, admin_password);

        await expect(AuthPage.alertInfo).toHaveText(expect.stringContaining('Password changed successfully'));
    });
});
