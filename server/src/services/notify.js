import nodemailer from 'nodemailer';
import { formatMoney } from '../lib/pricing.js';
import { config } from '../config.js';
import { t } from './i18n.js';
import { voucherPdf } from './voucher.js';
import { getSettings } from './settings.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port,
    secure: config.smtp.port === 465,   // 465 = SSL direct ; 587 = STARTTLS
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  })
  : null;

/** Ce qui est configuré sur le serveur (sans aucun secret) — écran Paramètres de l'admin */
export function notificationStatus() {
  return {
    smtp: !!transport, smtpHost: config.smtp.host || null, mailFrom: config.smtp.from, teamEmail: config.teamEmail || null,   // complété par la route avec l'adresse des Paramètres
    whatsappCloud: !!(config.whatsapp.token && config.whatsapp.phoneId),
    adminTemplate: config.whatsapp.template || null, clientTemplate: config.whatsapp.clientTemplate || null,
  };
}

/** E-mail(s) de l'équipe : Admin → Paramètres, sinon TEAM_EMAIL du serveur */
export async function teamEmail() {
  const s = await getSettings();
  const list = String(s.notifications?.adminEmail || config.teamEmail || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x));
  return list.join(', ') || null;
}

/** E-mail ; sans SMTP configuré, il est seulement affiché dans la console. Renvoie { ok, error }. */
export async function sendMail({ to, subject, html, attachments }) {
  if (!to) return { ok: false, error: 'Aucun destinataire' };
  if (!transport) { console.log(`[mail → ${to}] ${subject}`); return { ok: false, error: 'SMTP non configuré (SMTP_HOST vide dans server/.env)' }; }
  try { await transport.sendMail({ from: config.smtp.from, to, subject, html, attachments }); return { ok: true }; }
  catch (e) { console.error('[mail] échec', e.message); return { ok: false, error: e.message }; }
}

/** Appel à l'API WhatsApp Cloud ; renvoie { ok, error } avec la raison donnée par Meta */
async function postWhatsApp(body) {
  const r = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp.phoneId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.ok) return { ok: true };
  const err = await r.json().then((j) => j?.error?.error_data?.details || j?.error?.message, () => null);
  return { ok: false, error: `HTTP ${r.status}${err ? ` : ${err}` : ''}` };
}

/**
 * WhatsApp à un client ou un chauffeur. Avec WHATSAPP_CLIENT_TEMPLATE, le message part dans le modèle
 * approuvé, dans la langue du client ; sinon en texte libre (accepté par Meta seulement dans les 24 h
 * qui suivent un message de ce numéro). Sans jeton, le message est journalisé.
 */
export async function sendWhatsApp(to, text, { lang = 'fr' } = {}) {
  if (!to) return { ok: false, error: 'Aucun numéro' };
  const phone = String(to).replace(/[^\d]/g, '');
  if (!config.whatsapp.token) { console.log(`[whatsapp → ${phone}] ${text}`); return { ok: false, error: 'WhatsApp non configuré (WHATSAPP_TOKEN vide dans server/.env)' }; }
  try {
    return await postWhatsApp(whatsappPayload(phone, text, { template: config.whatsapp.clientTemplate, templateLang: lang }));
  } catch (e) { console.error('[whatsapp] échec', e.message); return { ok: false, error: e.message }; }
}

/**
 * Corps de l'appel à l'API WhatsApp Cloud. Avec un modèle approuvé (ex. « nouvelle_reservation »),
 * le texte devient la variable {{1}} : Meta refuse les retours à la ligne dans une variable,
 * ils sont remplacés par « · ».
 */
export function whatsappPayload(phone, text, { template, templateLang = 'fr' } = {}) {
  if (!template) return { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } };
  const flat = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean).join(' · ').replace(/\s{2,}/g, ' ').slice(0, 1000);
  return {
    messaging_product: 'whatsapp', to: phone, type: 'template',
    template: { name: template, language: { code: templateLang }, components: [{ type: 'body', parameters: [{ type: 'text', text: flat }] }] },
  };
}

/**
 * Message WhatsApp à l'équipe (numéros réglés dans Admin → Paramètres, sinon TEAM_WHATSAPP du .env).
 * Envoi par l'API WhatsApp Business si elle est configurée, sinon par CallMeBot si une clé est saisie.
 * Renvoie [{ phone, ok, via, error }].
 */
export async function notifyAdminWhatsApp(text) {
  const s = await getSettings();
  const n = s.notifications || {};
  const phones = String(n.adminWhatsapp || config.whatsapp.team || '').split(/[,;]+/).map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8);
  const out = [];
  for (const phone of phones) {
    try {
      if (config.whatsapp.token) {
        // En cas de refus, Meta explique la raison (token expiré, modèle non approuvé, numéro non autorisé…)
        out.push({ phone, via: 'whatsapp-business', ...(await postWhatsApp(whatsappPayload(phone, text, config.whatsapp))) });
      } else if (n.callmebotKey) {
        const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(n.callmebotKey)}`;
        const r = await fetch(url);
        const body = await r.text();
        // CallMeBot répond « Message queued » en cas de succès
        const ok = r.ok && (/queued|message sent/i.test(body) || !/error|invalid|wrong/i.test(body));
        out.push({ phone, ok, via: 'callmebot', error: ok ? undefined : body.replace(/<[^>]+>/g, ' ').trim().slice(0, 160) });
      } else {
        console.log(`[whatsapp équipe → ${phone}] ${text}`);
        out.push({ phone, ok: false, via: 'none', error: 'Aucun service d’envoi configuré' });
      }
    } catch (e) {
      console.error('[whatsapp équipe] échec', e.message);
      out.push({ phone, ok: false, via: config.whatsapp.token ? 'whatsapp-business' : 'callmebot', error: e.message });
    }
  }
  return out;
}

/** Texte d'une réservation (alerte équipe et bouton « Envoyer via WhatsApp » de l'admin) */
export function bookingText(b) {
  const c = b.customer || {};
  const p = (x) => [x?.adult && `${x.adult} ad.`, x?.child && `${x.child} enf.`, x?.infant && `${x.infant} bébé`].filter(Boolean).join(' + ');
  const extras = (i) => (i.lines || []).filter((l) => ['option', 'guide', 'cityTransfer'].includes(l.key))
    .map((l) => (l.key === 'guide' ? 'guide' : l.key === 'cityTransfer' ? `déplacement depuis ${l.label}` : l.label)).join(', ');
  const items = (b.items || []).map((i) => `• ${i.title} — ${i.date || ''}${i.time ? ` ${i.time}` : ''} — ${p(i.participants)}${extras(i) ? ` — ${extras(i)}` : ''} — ${formatMoney(i.totalEur || 0, 'EUR', 'fr')}`).join('\n');
  return [
    `Nouvelle réservation ${b.ref}`,
    `Client : ${c.name || ''} · ${c.phone || ''}${c.nationality ? ` · ${c.nationality}` : ''}`,
    (c.hotel || c.city) && `Hôtel : ${[c.hotel, c.city].filter(Boolean).join(', ')}${c.room ? ` (ch. ${c.room})` : ''}`,
    items,
    `Total : ${formatMoney(b.totalEur || 0, 'EUR', 'fr')} TTC (à régler sur place)`,
    c.notes && `Remarques : ${c.notes}`,
  ].filter(Boolean).join('\n');
}

const manageUrl = (b) => `${config.siteUrl}/${b.lang}/booking/${b.ref}?token=${b.token}`;

function layout(title, body) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213D;background:#F6F1E7;padding:12px;border-radius:14px">
  <div style="background:#14213D;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;border-bottom:3px solid #C9A227"><div style="font-family:Georgia,serif;font-size:22px;font-weight:bold">JS Travel <span style="color:#C9A227;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;font-weight:normal">TUNISIA</span></div><h1 style="margin:8px 0 0;font-size:18px;font-weight:normal">${title}</h1></div>
  <div style="background:#fff;border:1px solid #E7E1D3;border-top:0;padding:24px;border-radius:0 0 12px 12px">${body}</div></div>`;
}

function summary(b) {
  const L = b.lang;
  const extras = (i) => (i.lines || []).filter((l) => ['option', 'guide', 'cityTransfer'].includes(l.key))
    .map((l) => (l.key === 'guide' ? t(L, 'guide') : l.key === 'cityTransfer' ? `${t(L, 'transferFrom')} ${l.label}` : `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ''}`)).join(', ');
  const rows = b.items.map((i) => `<tr><td style="padding:6px 0">${i.title}<br><small>${i.date} ${i.time || ''}</small>${extras(i) ? `<br><small>${t(L, 'extras')} : ${extras(i)}</small>` : ''}</td><td style="text-align:right">${formatMoney(i.totalEur, 'EUR', L)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding-top:10px;font-weight:bold">${t(L, 'total')}</td><td style="text-align:right;font-weight:bold">${formatMoney(b.totalEur, 'EUR', L)} ${t(L, 'ttc')}</td></tr></table>`;
}

export async function notifyBookingCreated(b) {
  const L = b.lang;
  const s = await getSettings();
  const confirmed = b.status === 'confirmed';
  const pdf = confirmed ? await voucherPdf(b, { contact: s.contact }).catch(() => null) : null;
  // Chaque envoi est indépendant : un échec (client sans e-mail, WhatsApp non configuré…) n'empêche pas les autres
  const safe = (p) => p.catch((e) => console.error('[notification]', e.message));
  // Équipe d'abord : e-mail avec tout le détail + lien vers l'admin (§7.3)
  const adminUrl = `${config.siteUrl}/admin/bookings?ref=${b.ref}`;
  const c = b.customer || {};
  const esc = (x) => String(x ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch]);
  const info = [
    ['Client', c.name], ['Téléphone', c.phone], ['E-mail', c.email], ['Nationalité', c.nationality],
    ['Hôtel', [c.hotel, c.city].filter(Boolean).join(', ') + (c.room ? ` (ch. ${c.room})` : '')], ['Remarques', c.notes],
  ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#666;padding:2px 12px 2px 0">${k}</td><td><b>${esc(v)}</b></td></tr>`).join('');
  const n = s.notifications || {};
  if (n.teamByEmail !== false) await safe(sendMail({
    to: await teamEmail(),
    subject: `Nouvelle réservation ${b.ref} · ${c.name || ''} · ${formatMoney(b.totalEur, 'EUR', 'fr')}`,
    html: layout(`Nouvelle réservation ${b.ref}`, `<table>${info}</table>${summary({ ...(b.toObject?.() ?? b), lang: 'fr' })}<p><a href="${adminUrl}">Ouvrir la réservation dans l'admin</a></p>`),
  }));
  if (n.teamByWhatsapp !== false) await safe(notifyAdminWhatsApp(`${bookingText(b)}\nAdmin : ${adminUrl}`));
  // Client : e-mail de confirmation (avec voucher si confirmée) + WhatsApp
  await safe(sendMail({
    to: c.email,
    subject: `${confirmed ? t(L, 'confirmed') : t(L, 'received')} · ${b.ref}`,
    html: layout(confirmed ? t(L, 'confirmed') : t(L, 'received'),
      `<p>${t(L, 'hello')} ${c.name},</p>${confirmed ? '' : `<p>${t(L, 'pending')}</p>`}
       <p><b>${t(L, 'ref')} :</b> ${b.ref}</p>${summary(b)}<p>${t(L, 'payOnSite')}</p>
       <p><a href="${manageUrl(b)}">${t(L, 'manage')}</a></p>`),
    attachments: pdf ? [{ filename: `${b.ref}.pdf`, content: pdf }] : undefined,
  }));
  await safe(sendWhatsApp(c.phone, `${confirmed ? t(L, 'confirmed') : t(L, 'received')} · ${b.ref}\n${t(L, 'total')} : ${formatMoney(b.totalEur, 'EUR', L)} ${t(L, 'ttc')}\n${manageUrl(b)}`, { lang: L }));
}

export async function notifyStatus(b, kind) {
  const L = b.lang;
  const s = await getSettings();
  const titles = { confirmed: t(L, 'confirmed'), cancelled: t(L, 'cancelled'), reminder: t(L, 'reminder') };
  if (!titles[kind]) return;
  const pdf = ['confirmed', 'reminder'].includes(kind) ? await voucherPdf(b, { contact: s.contact }) : null;
  await sendMail({
    to: b.customer.email, subject: `${titles[kind]} · ${b.ref}`,
    html: layout(titles[kind], `<p>${t(L, 'hello')} ${b.customer.name},</p><p><b>${t(L, 'ref')} :</b> ${b.ref}</p>${summary(b)}<p><a href="${manageUrl(b)}">${t(L, 'manage')}</a></p>`),
    attachments: pdf ? [{ filename: `${b.ref}.pdf`, content: pdf }] : undefined,
  });
  await sendWhatsApp(b.customer.phone, `${titles[kind]} · ${b.ref}\n${manageUrl(b)}`, { lang: L });
}

export async function requestReview(b) {
  const L = b.lang;
  const s = await getSettings();
  const links = [s.social?.tripadvisor && `<a href="${s.social.tripadvisor}">Tripadvisor</a>`, s.social?.googleReviews && `<a href="${s.social.googleReviews}">Google</a>`].filter(Boolean).join(' · ');
  await sendMail({ to: b.customer.email, subject: t(L, 'review'), html: layout(t(L, 'review'), `<p>${t(L, 'hello')} ${b.customer.name},</p><p>${t(L, 'reviewAsk')}</p><p>${links}</p><p>${t(L, 'thanks')}</p>`) });
  await sendWhatsApp(b.customer.phone, `${t(L, 'reviewAsk')} ${s.social?.googleReviews || s.social?.tripadvisor || ''}`, { lang: L });
}

/** Feuille de route quotidienne du chauffeur (§7.3) */
export async function sendDriverRoadmap(driver, items) {
  const lines = items.map((i) => `${i.time || ''} · ${i.title} · ${i.customer} · ${i.hotel || i.transfer?.from || ''} · ${i.phone || ''}`).join('\n');
  await sendWhatsApp(driver.phone, `Feuille de route\n${lines || 'Aucune prestation'}`, { lang: 'fr' });
}
