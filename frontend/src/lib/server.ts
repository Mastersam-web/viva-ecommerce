/** Appels API côté serveur (Server Components) : directement vers Express, avec cache court. */
const API = process.env.API_URL || 'http://localhost:4000';

export async function serverGet<T = any>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
