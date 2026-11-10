import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { config } from './config.js';
import { User, AuditLog } from './models/index.js';
import { HttpError } from './services/booking.js';

export const signToken = (user, extra = {}) =>
  jwt.sign({ sub: String(user._id), role: user.role, ...extra }, config.jwtSecret, { expiresIn: '12h' });

/** Vérifie le jeton et charge l'utilisateur. Un jeton « pre2fa » ne donne accès qu'à la vérification 2FA. */
export async function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED');
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw new HttpError(401, 'INVALID_TOKEN'); }
  if (payload.pre2fa) throw new HttpError(401, 'TWO_FACTOR_REQUIRED');
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.active) throw new HttpError(401, 'INVALID_TOKEN');
  req.user = user;
  next();
}

/** Rôles autorisés. L'administrateur a toujours accès. */
export const allow = (...roles) => (req, _res, next) => {
  if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
  throw new HttpError(403, 'FORBIDDEN');
};

/** Journal des actions (§7.2) */
export async function audit(req, action, entity, entityId, before, after) {
  await AuditLog.create({ user: req.user?._id, userName: req.user?.name || req.user?.email, action, entity, entityId: String(entityId || ''), before, after });
}

/** Vérification anti-robots : Cloudflare Turnstile si configuré, plus un champ piège. */
export async function antiSpam(req, _res, next) {
  if (req.body?.website) throw new HttpError(400, 'SPAM'); // champ caché « website » rempli = robot
  if (!config.turnstileSecret) return next();
  const token = req.body?.captchaToken;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: config.turnstileSecret, response: token || '', remoteip: req.ip }),
  }).then((x) => x.json()).catch(() => ({ success: false }));
  if (!r.success) throw new HttpError(400, 'CAPTCHA_FAILED');
  next();
}

/** Route d'API inconnue : réponse JSON (et non la page HTML d'Express « Cannot GET … ») */
export function apiNotFound(_req, res) {
  res.status(404).json({ error: 'NOT_FOUND' });
}

/**
 * Gestion centrale des erreurs : le client reçoit uniquement un code (ex. VALIDATION, NOT_FOUND)
 * et, au besoin, un message rédigé pour l'utilisateur. Jamais de trace technique ni de message interne.
 * Le détail complet est écrit dans les journaux du serveur.
 */
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    const { fieldErrors } = err.flatten();
    return res.status(400).json({ error: 'VALIDATION', details: { fields: Object.keys(fieldErrors || {}) } });
  }
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(`[api] ${req.method} ${req.originalUrl} →`, err.code, err.message);
    const body = { error: err.code };
    // Message lisible seulement s'il a été écrit pour l'utilisateur (sinon le message vaut le code)
    if (err.message && err.message !== err.code && err.status < 500) body.message = err.message;
    if (err.details && err.status < 500) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'DUPLICATE' });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'BAD_ID' });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: 'VALIDATION', details: { fields: Object.keys(err.errors || {}) } });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_REQUEST' });
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'TOO_LARGE' });
  if (err?.name === 'MulterError') return res.status(400).json({ error: 'BAD_FILE' });
  console.error(`[api] ${req.method} ${req.originalUrl} →`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}
