import nodemailer from 'nodemailer';
import { formatMoney } from '../lib/pricing.js';
import { config } from '../config.js';
import { t } from './i18n.js';
import { voucherPdf } from './voucher.js';
import { getSettings } from './settings.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, auth: { user: config.smtp.user, pass: config.smtp.pass } })
  : null;

export async function sendMail({ to, subject, html, attachments }) {
  if (!to) return;
  if (!transport) { console.log(`[mail → ${to}] ${subject}`); return; }
  try { await transport.sendMail({ from: config.smtp.from, to, subject, html, attachments }); }
  catch (e) { console.error('[mail] échec', e.message); }
}

/** WhatsApp Cloud API (message texte). Sans jeton configuré, le message est journalisé. */
export async function sendWhatsApp(to, text) {
  if (!to) return;
  const phone = String(to).replace(/[^\d]/g, '');
  if (!config.whatsapp.token) { console.log(`[whatsapp → ${phone}] ${text}`); return; }
  try {
    await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } }),
    });
  } catch (e) { console.error('[whatsapp] échec', e.message); }
}

const manageUrl = (b) => `${config.siteUrl}/${b.lang}/booking/${b.ref}?token=${b.token}`;

function layout(title, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213D;background:#F6F1E7;padding:12px;border-radius:14px">
  <div style="background:#14213D;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;border-bottom:3px solid #C9A227"><div style="font-family:Georgia,serif;font-size:22px;font-weight:bold">JS Travel <span style="color:#C9A227;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;font-weight:normal">TUNISIA</span></div><h1 style="margin:8px 0 0;font-size:18px;font-weight:normal">${title}</h1></div>
  <div style="background:#fff;border:1px solid #E7E1D3;border-top:0;padding:24px;border-radius:0 0 12px 12px">${body}</div></div>`;
}

function summary(b) {
  const L = b.lang;
  const rows = b.items.map((i) => `<tr><td style="padding:6px 0">${i.title}<br><small>${i.date} ${i.time || ''}</small></td><td style="text-align:right">${formatMoney(i.totalEur, 'EUR', L)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding-top:10px;font-weight:bold">${t(L, 'total')}</td><td style="text-align:right;font-weight:bold">${formatMoney(b.totalEur, 'EUR', L)}</td></tr></table>`;
}

export async function notifyBookingCreated(b) {
  const L = b.lang;
  const s = await getSettings();
  const confirmed = b.status === 'confirmed';
  const pdf = confirmed ? await voucherPdf(b, { contact: s.contact }) : null;
  await sendMail({
    to: b.customer.email,
    subject: `${confirmed ? t(L, 'confirmed') : t(L, 'received')} · ${b.ref}`,
    html: layout(confirmed ? t(L, 'confirmed') : t(L, 'received'),
      `<p>${t(L, 'hello')} ${b.customer.name},</p>${confirmed ? '' : `<p>${t(L, 'pending')}</p>`}
       <p><b>${t(L, 'ref')} :</b> ${b.ref}</p>${summary(b)}<p>${t(L, 'payOnSite')}</p>
       <p><a href="${manageUrl(b)}">${t(L, 'manage')}</a></p>`),
    attachments: pdf ? [{ filename: `${b.ref}.pdf`, content: pdf }] : undefined,
  });
  await sendWhatsApp(b.customer.phone, `${confirmed ? t(L, 'confirmed') : t(L, 'received')} · ${b.ref}\n${t(L, 'total')} : ${formatMoney(b.totalEur, 'EUR', L)}\n${manageUrl(b)}`);
  // Équipe : e-mail + WhatsApp (§7.3)
  const team = `Nouvelle réservation ${b.ref} · ${b.customer.name} · ${b.items.map((i) => `${i.title} (${i.date})`).join(', ')} · ${formatMoney(b.totalEur, 'EUR', 'fr')}`;
  await sendMail({ to: config.teamEmail, subject: `Nouvelle réservation ${b.ref}`, html: layout('Nouvelle réservation', `<p>${team}</p>${summary({ ...b.toObject?.() ?? b, lang: 'fr' })}`) });
  await sendWhatsApp(config.whatsapp.team, team);
}

export async function notifyStatus(b, kind) {
  const L = b.lang;
  const s = await getSettings();
  const titles = { confirmed: t(L, 'confirmed'), cancelled: t(L, 'cancelled'), reminder: t(L, 'reminder'), driver: t(L, 'driver') };
  const pdf = ['confirmed', 'driver', 'reminder'].includes(kind) ? await voucherPdf(b, { contact: s.contact }) : null;
  await sendMail({
    to: b.customer.email, subject: `${titles[kind]} · ${b.ref}`,
    html: layout(titles[kind], `<p>${t(L, 'hello')} ${b.customer.name},</p><p><b>${t(L, 'ref')} :</b> ${b.ref}</p>${summary(b)}<p><a href="${manageUrl(b)}">${t(L, 'manage')}</a></p>`),
    attachments: pdf ? [{ filename: `${b.ref}.pdf`, content: pdf }] : undefined,
  });
  await sendWhatsApp(b.customer.phone, `${titles[kind]} · ${b.ref}\n${manageUrl(b)}`);
}

export async function requestReview(b) {
  const L = b.lang;
  const s = await getSettings();
  const links = [s.social?.tripadvisor && `<a href="${s.social.tripadvisor}">Tripadvisor</a>`, s.social?.googleReviews && `<a href="${s.social.googleReviews}">Google</a>`].filter(Boolean).join(' · ');
  await sendMail({ to: b.customer.email, subject: t(L, 'review'), html: layout(t(L, 'review'), `<p>${t(L, 'hello')} ${b.customer.name},</p><p>${t(L, 'reviewAsk')}</p><p>${links}</p><p>${t(L, 'thanks')}</p>`) });
  await sendWhatsApp(b.customer.phone, `${t(L, 'reviewAsk')} ${s.social?.tripadvisor || ''}`);
}

/** Feuille de route quotidienne du chauffeur (§7.3) */
export async function sendDriverRoadmap(driver, items) {
  const lines = items.map((i) => `${i.time || ''} · ${i.title} · ${i.customer} · ${i.hotel || i.transfer?.from || ''} · ${i.phone || ''}`).join('\n');
  await sendWhatsApp(driver.phone, `Feuille de route\n${lines || 'Aucune prestation'}`);
}
