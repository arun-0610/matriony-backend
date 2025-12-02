
const nodemailer = require('nodemailer');
module.exports = async function sendEmail(to, subject, text){
  // configure via env variables in production
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER || 'user', pass: process.env.SMTP_PASS || 'pass' }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@example.com', to, subject, text });
};
