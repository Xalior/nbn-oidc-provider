/* eslint-disable no-console, camelcase, no-unused-vars */
import home from './home.js';
import register from './register.js';
import confirm from './confirm.js';
import reconfirm from './reconfirm.js';
import profile from './profile.js';

export default (app) => {
    home(app);
    register(app);
    confirm(app);
    reconfirm(app);
    profile(app);
};
