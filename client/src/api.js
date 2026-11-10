/**
 * Client HTTP minimal pour l'API.
 * VITE_API_URL (fichier client/.env) = adresse de l'API si elle est sur un autre domaine,
 * ex. https://api.mon-site.com — vide = même domaine (Nginx renvoie /api vers le serveur).
 */
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
/** Fichiers envoyés depuis l'admin (/uploads/...) : servis par l'API */
export const assetUrl = (u) => (u && u.startsWith('/uploads/') ? `${API_URL}${u}` : u);

export class ApiError extends Error {
  constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.body = body; }
}

async function request(method, path, body, { token, lang } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_URL}/api${path}${lang ? `${sep}lang=${lang}` : ''}`;
  let res;
  try { res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError(0, { error: 'NETWORK' }); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  del: (p, o) => request('DELETE', p, undefined, o),
};

/** Back-office : ajoute automatiquement le jeton */
const tokenKey = 'tt_admin_token';
export const adminToken = {
  get: () => { try { return localStorage.getItem(tokenKey); } catch { return null; } },
  set: (t) => { try { t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey); } catch {} },
};
export const adminApi = Object.fromEntries(['get', 'post', 'put', 'patch', 'del'].map((m) => [m, (p, b) => {
  const token = adminToken.get();
  const call = m === 'get' || m === 'del' ? api[m](`/admin${p}`, { token }) : api[m](`/admin${p}`, b, { token });
  return call.catch((e) => { if (e.status === 401) { adminToken.set(null); window.location.href = '/admin/login'; } throw e; });
}]));

/** Envoi de fichiers depuis l'admin (photos, vidéos MP4). Renvoie [{ url, name, size }]. */
export async function adminUpload(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  let res;
  try { res = await fetch(`${API_URL}/api/admin/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken.get()}` }, body: fd }); }
  catch { throw new ApiError(0, { error: 'NETWORK' }); }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  if (!Array.isArray(data) || data.length < files.length) throw new ApiError(400, { error: 'BAD_FILE' });
  return data;
}

/** Téléchargement authentifié (CSV) */
export async function adminDownload(path, filename) {
  const res = await fetch(`${API_URL}/api/admin${path}`, { headers: { Authorization: `Bearer ${adminToken.get()}` } });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}
