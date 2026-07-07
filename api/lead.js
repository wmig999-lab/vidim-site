// =============================================================
// api/lead.js — серверный приём заявок (замена EmailJS в браузере)
// Отправляет заявку на info@ через Яндекс-SMTP (nodemailer), как sendInternalEmail в report.js.
// Причина: EmailJS (US) + его CDN cdn.jsdelivr.net в РФ режутся → формы не работают и рендер виснет.
// Env (Vercel): SMTP_USER, SMTP_PASS (пароль приложения Яндекса), опц. VIDIM_TEAM_EMAIL.
// Тело POST: { name, company, contact, comment, source, details?, company_url? (honeypot) }
//   source: 'tier' (диагностика) | 'audit' (звонок по аудиту) | 'brief-fallback' | иное.
// =============================================================

const nodemailer = require('nodemailer');

function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'invalid json' }); } }
  body = body || {};

  // honeypot — тихо «принимаем» ботов, ничего не шлём
  if (body.company_url) return res.status(200).json({ ok: true });

  const name = (body.name || '').toString().trim();
  const company = (body.company || '').toString().trim();
  const contact = (body.contact || '').toString().trim();
  const comment = (body.comment || '').toString().trim();
  const source = (body.source || 'landing').toString().trim();
  const details = (body.details || '').toString().trim();

  if (!name || !company || !contact) return res.status(400).json({ error: 'name, company, contact required' });

  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass) { console.error('[lead] SMTP_USER/SMTP_PASS not set'); return res.status(503).json({ error: 'mail not configured', fallback: true }); }

  const map = {
    audit: { kind: 'ЗАКАЗ ЗВОНКА — АУДИТ', emoji: '📞' },
    tier: { kind: 'ЗАЯВКА НА ДИАГНОСТИКУ (без брифа)', emoji: '🔥' },
    'brief-fallback': { kind: 'ЗАЯВКА С БРИФА (фолбэк)', emoji: '📋' },
  };
  const m = map[source] || { kind: 'ЗАЯВКА', emoji: '📩' };

  const pad = n => (n < 10 ? '0' : '') + n;
  const msk = new Date(Date.now() + 3 * 3600 * 1000); // МСК
  const sentAt = `${pad(msk.getUTCDate())}.${pad(msk.getUTCMonth() + 1)}.${msk.getUTCFullYear()} ${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())} МСК`;

  const rows = [
    ['Тип', m.kind],
    ['Имя', name],
    ['Компания', company],
    ['Контакт', contact],
    ['Комментарий', comment || '—'],
    ['Источник', source],
    ['Время', sentAt],
  ];
  if (details) rows.push(['Детали', details]);

  const html = '<div style="font-family:Onest,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#12161f;max-width:640px;border:1px solid #dde0e4;border-radius:10px;overflow:hidden">'
    + '<div style="background:#12161f;color:#fff;padding:18px 24px;font-weight:700">' + m.emoji + ' ' + h(m.kind) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:14px">'
    + rows.map(([k, v]) => '<tr><td style="padding:9px 24px;color:#70747e;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eceef2">' + h(k) + '</td><td style="padding:9px 24px;border-bottom:1px solid #eceef2">' + h(v).replace(/\n/g, '<br>') + '</td></tr>').join('')
    + '</table></div>';
  const text = m.emoji + ' ' + m.kind + '\n\n' + rows.map(([k, v]) => k + ': ' + v).join('\n');

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru', port: 465, secure: true, auth: { user, pass },
      connectionTimeout: 9000, greetingTimeout: 9000, socketTimeout: 12000,
    });
    const to = process.env.VIDIM_TEAM_EMAIL || 'info@abc-xr.ru';
    // «бриф Видим» в начале темы → правило Яндекса кладёт письмо в папку Vidim
    const subject = 'бриф Видим · ' + m.kind + ' — ' + company;
    await transporter.sendMail({ from: '"Vidim Заявка" <' + user + '>', to, subject, text, html, replyTo: /@/.test(contact) ? contact : undefined });
    console.log('[lead] sent →', to, '· source', source);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[lead] send failed', e.message);
    return res.status(500).json({ error: e.message, fallback: true });
  }
};

module.exports.config = { maxDuration: 15 };
