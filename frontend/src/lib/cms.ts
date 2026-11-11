import { serverGet } from './server';

/** Lit un contenu éditable (back-office → Contenu). Retourne null s'il n'est pas défini. */
export async function getContent(name: string): Promise<string | null> {
  const r = await serverGet<{ value: string | null }>(`/content/${name}`, 30);
  return r?.value || null;
}
export async function getJsonContent<T>(name: string): Promise<T | null> {
  const v = await getContent(name);
  if (!v) return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}
