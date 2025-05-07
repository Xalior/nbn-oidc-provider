import Page from './page.ts';
import { browser } from "@wdio/globals";

class BasicPage extends Page {
    async open(path?: string): Promise<string> {
        if (!path) {
            path = '/';
        }
        return await browser.url(path);
    }
}

export default new BasicPage();