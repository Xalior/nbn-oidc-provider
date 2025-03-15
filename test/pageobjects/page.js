import {$, browser} from '@wdio/globals'

/**
 * main page object containing all methods, selectors and functionality
 * that is shared across all page objects
 */
export default class Page {
    /**
     * Opens a sub page of the page
     * @param path path of the sub page (e.g. /path/to/page.html)
     */
    async open (path) {
        return await browser.url(path);
    }

    get navbar () {
        return $('.navbar');
    }

    get alertFlash () {
        return $('.alert-flash');
    }

    get alertInfo () {
        return $('.alert-info');
    }
    get alertDanger () {
        return $('.alert-danger');
    }
}