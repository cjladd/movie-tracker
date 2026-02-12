const env = require('../config/env');
const logger = require('./logger');

function buildResetEmailHtml({ name, resetUrl }) {
  const safeName = name || 'there';
  return `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Password Reset Request</h2>
      <p style="margin: 0 0 12px;">Hi ${safeName},</p>
      <p style="margin: 0 0 12px;">
        We received a request to reset your MovieNightPlanner password.
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 14px; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>
      <p style="margin: 0 0 8px;">If the button does not work, use this link:</p>
      <p style="margin: 0 0 12px; word-break: break-word;">${resetUrl}</p>
      <p style="margin: 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

function buildResetEmailText({ name, resetUrl }) {
  const safeName = name || 'there';
  return [
    `Hi ${safeName},`,
    '',
    'We received a request to reset your MovieNightPlanner password.',
    `Use this link to reset it: ${resetUrl}`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
}

async function sendViaResend({ to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.email.resendFrom,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend rejected request (${response.status}): ${body}`);
  }
}

async function sendPasswordResetEmail({ toEmail, toName, resetUrl }) {
  const subject = 'Reset your MovieNightPlanner password';
  const html = buildResetEmailHtml({ name: toName, resetUrl });
  const text = buildResetEmailText({ name: toName, resetUrl });

  if (!env.email.resendApiKey || !env.email.resendFrom) {
    logger.warn('Email provider is not configured; password reset email was not delivered');
    if (!env.isProduction) {
      logger.info(`Password reset URL (dev fallback): ${resetUrl}`);
    }
    return;
  }

  await sendViaResend({
    to: [toEmail],
    subject,
    html,
    text,
  });
}

module.exports = {
  sendPasswordResetEmail,
};
