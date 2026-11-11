import Link from 'next/link';
import type { Metadata } from 'next';
import Pagination from '@/components/Pagination';
import { PageHeader, Shell, card } from '@/components/ui';
import { dateFr } from '@/lib/api';
import { serverGet } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Blog', description: 'Conseils, nouveautés et inspirations VIVA Live Better.', alternates: { canonical: '/blog' } };

export default async function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await serverGet<{ posts: any[]; meta: { page: number; pages: number } }>(`/posts?page=${page}`, 0);
  const posts = data?.posts || [];
  return (
    <Shell>
      <PageHeader badge="Blog" title="Nos conseils & actualités" />
      {posts.length === 0 ? <div className={`${card} p-12 text-center text-sm text-gray-500`}>Aucun article pour le moment.</div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{posts.map((p) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className={`${card} overflow-hidden hover:shadow-md transition block`}>
            {p.cover_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.cover_url} alt="" className="w-full h-44 object-cover" loading="lazy" />}
            <div className="p-5 space-y-2"><p className="text-[11px] text-gray-400">{dateFr(p.published_at)}</p><h2 className="font-extrabold text-pine-900">{p.title}</h2><p className="text-xs text-gray-600 line-clamp-3">{p.excerpt}</p></div>
          </Link>))}</div>)}
      {data && <Pagination base="/blog" params={{}} page={data.meta.page} pages={data.meta.pages} />}
    </Shell>
  );
}
