import Page from './page.js';
import {$} from "@wdio/globals";

class BasicPage extends Page{
    /**
     * define selectors using getter methods
     */
    get flashAlert () {
        return $('#flash');
    }
}

export default new BasicPage();