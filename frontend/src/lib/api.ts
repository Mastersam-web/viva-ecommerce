/** Client API : même origine (réécriture Next.js → Express), cookie httpOnly, en-tête anti-CSRF. */
export class ApiError extends Error {
  status: number;
  details?: any;
  constructor(status: number, message: string, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non JSON */ }
  if (!res.ok) {
    const detail = data?.details?.[0]?.message ? ` (${data.details[0].field} : ${data.details[0].message})` : '';
    throw new ApiError(res.status, (data?.error || `Erreur ${res.status}`) + (res.status === 422 ? detail : ''), data?.details);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>('GET', p),
  post: <T = any>(p: string, b: any = {}) => request<T>('POST', p, b),
  put: <T = any>(p: string, b: any = {}) => request<T>('PUT', p, b),
  patch: <T = any>(p: string, b: any = {}) => request<T>('PATCH', p, b),
  del: <T = any>(p: string) => request<T>('DELETE', p),
  async upload(files: FileList | File[]): Promise<string[]> {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'Échec du téléversement');
    return data.urls;
  },
};

export const qs = (params: Record<string, any>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : '';
};

/** Format de prix identique à l'original : $12.34 */
export const money = (n: number | string | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;
export const dateFr = (d?: string | Date | null, withTime = false) =>
  d ? new Date(d).toLocaleString('fr-FR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'medium' }) : '-';
