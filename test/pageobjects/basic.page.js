import Page from './page.js';
import {$, browser} from "@wdio/globals";

class BasicPage extends Page{
    async open (path) {
        if(!path) {
            path='/';
        }
        return await browser.url(path);
    }
}

export default new BasicPage();