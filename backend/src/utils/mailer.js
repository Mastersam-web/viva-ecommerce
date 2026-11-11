const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml, cta) {
  return `<!doctype html><html><body style="margin:0;background:#f5f8f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8f0ec">
    <div style="background:#0f382c;color:#fff;padding:20px 28px;font-size:22px;font-weight:800;letter-spacing:1px">VIVA <span style="font-size:11px;letter-spacing:3px;color:#6ee7b7">LIVE BETTER</span></div>
    <div style="padding:28px"><h2 style="margin:0 0 12px;color:#0f382c;font-size:18px">${esc(title)}</h2>
    <div style="font-size:14px;line-height:1.6">${bodyHtml}</div>
    ${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#0f382c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px">${esc(cta.label)}</a></p>` : ''}
    </div><div style="padding:16px 28px;background:#f5f8f6;font-size:11px;color:#6b7280">© ${new Date().getFullYear()} VIVA Live Better</div>
  </div></body></html>`;
}

/** Envoie un email. Sans SMTP configuré : affichage console (mode développement). */
async function sendMail({ to, subject, title, html, cta, replyTo }) {
  const body = layout(title || subject, html, cta);
  if (!transporter) {
    if (!env.isProd || process.env.NODE_ENV !== 'test') console.log(`[mail:console] → ${to} | ${subject}${cta ? ` | ${cta.url}` : ''}`);
    return { simulated: true };
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html: body, ...(replyTo ? { replyTo } : {}) });
    return { sent: true };
  } catch (e) {
    console.error('[mail] échec', e.message);
    return { error: e.message };
  }
}
module.exports = { sendMail, esc };
