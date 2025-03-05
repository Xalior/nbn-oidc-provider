import {$, expect} from '@wdio/globals'
import BasicPage from '../pageobjects/basic.page.js'
import AuthPage from '../pageobjects/auth.page.js'
import SecurePage from '../pageobjects/secure.page.js'

describe('Client Interface', () => {
    it('Can Login', async () => {
        await AuthPage.login('darran@xalior.com', '123123qweqweASDASD');
        await expect(AuthPage.navbar).toHaveText(expect.stringContaining('Logout'));
    })

    it('Can Logout', async () => {
        await BasicPage.open('/');
        await expect(AuthPage.navbar).toHaveText(expect.stringContaining('Logout'));
        await AuthPage.logout();
        await expect(AuthPage.navbar).toHaveText(expect.stringContaining('Login'));
    })
})

