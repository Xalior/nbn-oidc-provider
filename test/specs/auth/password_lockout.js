import {$, expect} from '@wdio/globals'
import BasicPage from '../../pageobjects/basic.page.js'
import AuthPage from '../../pageobjects/auth.page.js'
import SecurePage from '../../pageobjects/secure.page.js'
import {db} from "../../../src/db/index.js";
import {confirmation_codes, users} from "../../../src/db/schema.js";
import {and, eq} from "drizzle-orm";
import {hashAccountPassword} from "../../../src/models/account.js";

const admin_email = 'darran@xalior.com';
let admin_password = '123123qweqweASDASD';
const admin_account_id = 1;

describe('Authentication:Password Lockout', () => {
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


    it("01: Can't login with invalid credentials...", async () => {
        await AuthPage.login(admin_email, 'password');
        await expect(AuthPage.alertDanger).toHaveText(expect.stringContaining('Login failed'));
    });

    it("02: Can detect repeated failed logins...", async () => {
        await AuthPage.login(admin_email, 'password');
        await expect(AuthPage.alertDanger).toHaveText(expect.stringContaining('Login failed'));
        await AuthPage.login(admin_email, 'password');
        await expect(AuthPage.alertDanger).toHaveText(expect.stringContaining('Login failed'));
        // The account should now be locked, let's try a valid password to be sure... and see...
        await AuthPage.login(admin_email, admin_password);
        await expect(AuthPage.alertDanger).toHaveText(expect.stringContaining('Account Locked'));
        // Now unlock the account
        await init();
    });
})

