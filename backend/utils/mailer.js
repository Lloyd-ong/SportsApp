const nodemailer = require('nodemailer');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
};

const isResetMailerConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const port = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const appName = process.env.APP_NAME || 'PlayNet';
  const from = process.env.SMTP_FROM;
  const subject = `${appName} password reset`;
  const text = [
    `You requested a password reset for ${appName}.`,
    `Reset your password using this link: ${resetLink}`,
    'This link will expire in 1 hour.'
  ].join('\n\n');
  const html = `
    <p>You requested a password reset for <strong>${appName}</strong>.</p>
    <p><a href="${resetLink}">Reset your password</a></p>
    <p>This link will expire in 1 hour.</p>
  `;

  return getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html
  });
};

module.exports = {
  isResetMailerConfigured,
  sendPasswordResetEmail
};
