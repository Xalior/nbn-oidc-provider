/* eslint-disable no-console, camelcase, no-unused-vars */
import home from './home.js';
import profile from './profile.js';
import register from './register.js';

export default (app) => {
    home(app);
    register(app);
    profile(app);
};
