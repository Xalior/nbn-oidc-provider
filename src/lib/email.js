import config from '../../data/config.js';
import {createTransport} from "nodemailer";

export const transporter = createTransport(config.smtp);

export const sendConfirmationEmail = async (email, confirmation_code) => {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"NBN:ID" <noreply@nextbestnetwork.com>', // sender address
    to: email, // list of receivers
    subject: "✔ NBN:ID Account Confirmation", // Subject line
    text: `NBN:ID Account Confirmation Email
    
    Please visit ${config.provider_url}confirm?${confirmation_code} to confirm your account`, // plain text body

    html: `<b>NBN:ID Account Confirmation Email<a><br>
  <br>
  Please visit <a href="${config.provider_url}confirm?${confirmation_code}">
    ${config.provider_url}confirm?${confirmation_code}</a> to confirm your account`,
  });

  console.log("Message sent: %s", info);
}

export const sendLoginPinEmail = async (email, pin_code) => {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"NBN:ID" <noreply@nextbestnetwork.com>', // sender address
    to: email, // list of receivers
    subject: "🔒 NBN:ID Login PIN", // Subject line
    text: `NBN:ID Login PIN
    
    You attempted to log into NBN:ID - and that required this time sensitive passcode.
    
    Your one use passcode is: ${pin_code}
    
    If you did not log in, then someone could have your password!
    You should log in, immediately, and change your password to something new - and unique.
    
    Please visit ${config.provider_url}lost_password to reset your account`, // plain text body

    html: `<b>NBN:ID Login PIN<a><br>
  <br>
    You attempted to log into NBN:ID - and that required this time sensitive passcode.
  <br>
  <h2>Your one use passcode is: ${pin_code}</h2>
  <br>
    If you did not log in, then someone could have your password!
    You should log in, immediately, and change your password to something new - and unique.
  <br>
  Please visit <a href="${config.provider_url}lost_password">
    ${config.provider_url}lost_password</a> to reset your password`,
  });

  console.log("Message sent: %s", info);
}

export const sendPasswordResetEmail = async (email, confirmation_code) => {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"NBN:ID" <noreply@nextbestnetwork.com>', // sender address
    to: email, // list of receivers
    subject: "✔ NBN:ID Password Reset", // Subject line
    text: `NBN:ID Password Reset Email
    
    Please visit ${config.provider_url}reset_password?${confirmation_code} to reset your account`, // plain text body

    html: `<b>NBN:ID Password Reset Email<a><br>
  <br>
  Please visit <a href="${config.provider_url}reset_password?${confirmation_code}">
    ${config.provider_url}reset_password?${confirmation_code}</a> to reset your password`,
  });

  console.log("Message sent: %s", info);
}
