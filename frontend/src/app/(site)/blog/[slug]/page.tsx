import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Shell, card } from '@/components/ui';
import { dateFr } from '@/lib/api';
import { serverGet } from '@/lib/server';

export const dynamic = 'force-dynamic';
type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await serverGet<{ post: any }>(`/posts/${params.slug}`, 0);
  if (!d) return { title: 'Article introuvable' };
  return { title: d.post.title, description: d.post.excerpt || undefined, alternates: { canonical: `/blog/${d.post.slug}` }, openGraph: { title: d.post.title, description: d.post.excerpt || undefined, images: d.post.cover_url ? [d.post.cover_url] : undefined } };
}

export default async function Page({ params }: Props) {
  const d = await serverGet<{ post: any }>(`/posts/${params.slug}`, 0);
  if (!d) notFound();
  const p = d.post;
  return (
    <Shell>
      <article className={`${card} overflow-hidden max-w-3xl mx-auto`}>
        {p.cover_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.cover_url} alt="" className="w-full max-h-80 object-cover" />}
        <div className="p-6 sm:p-10 space-y-4"><Link href="/blog" className="text-xs font-bold text-accent-600">← Blog</Link><p className="text-[11px] text-gray-400">{dateFr(p.published_at)}</p><h1 className="text-3xl font-black text-pine-900">{p.title}</h1>
          <div className="prose-viva" dangerouslySetInnerHTML={{ __html: p.content || '' }} /></div>
      </article>
    </Shell>
  );
}
