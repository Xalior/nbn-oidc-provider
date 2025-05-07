/* eslint-disable no-console, camelcase, no-unused-vars */
import home from './home.js';
import register from './register.ts';
import confirm from './confirm.js';
import reconfirm from './reconfirm.js';
import profile from './profile.js';
import lost_password from './lost_password.js';
import reset_password from "./reset_password.js";
import { Application } from 'express';

export default (app: Application): void => {
    home(app);
    register(app);
    confirm(app);
    reconfirm(app);
    profile(app);
    lost_password(app);
    reset_password(app);
};