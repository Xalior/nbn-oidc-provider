
import config from '../../config.js';
import {createTransport} from "nodemailer";

export const transporter = createTransport(config.smtp);

export const sendConfirmationEmail = async (user) => {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"NBN:ID" <noreply@nextbestnetwork.com>', // sender address
    to: user.email, // list of receivers
    subject: "✔ NBN:ID Account Confirmation", // Subject line
    text: `NBN:ID Account Confirmation Email
    
    Please visit http:// /confirm?${user.hmac_key}`, // plain text body

    html: "<b>Hello world?</b>", // html body
  });

  console.log("Message sent: %s", info);
}
