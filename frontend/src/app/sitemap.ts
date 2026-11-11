import type { MetadataRoute } from 'next';
import { SITE_URL, serverGet } from '@/lib/server';

export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics = ['', '/boutique', '/a-propos', '/contact', '/faq', '/livraison', '/retours', '/conditions-generales', '/confidentialite', '/mentions-legales', '/blog', '/suivi'];
  const out: MetadataRoute.Sitemap = statics.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: p === '' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.6 }));
  for (let page = 1; page <= 20; page++) {
    const r = await serverGet<{ products: any[]; meta: { pages: number } }>(`/products?limit=48&page=${page}`, 0);
    if (!r) break;
    r.products.forEach((p) => out.push({ url: `${SITE_URL}/produit/${p.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 }));
    if (page >= r.meta.pages) break;
  }
  const posts = await serverGet<{ posts: any[] }>('/posts?limit=30', 0);
  posts?.posts.forEach((p) => out.push({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: now, priority: 0.5 }));
  return out;
}
