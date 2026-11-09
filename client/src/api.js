/** Client HTTP minimal pour l'API. */
export class ApiError extends Error {
  constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.body = body; }
}

async function request(method, path, body, { token, lang } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api${path}${lang ? `${sep}lang=${lang}` : ''}`;
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

/** Téléchargement authentifié (CSV) */
export async function adminDownload(path, filename) {
  const res = await fetch(`/api/admin${path}`, { headers: { Authorization: `Bearer ${adminToken.get()}` } });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}
