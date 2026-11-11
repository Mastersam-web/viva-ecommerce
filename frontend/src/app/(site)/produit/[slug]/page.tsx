import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductView from '@/components/ProductView';
import ProductReviews from '@/components/ProductReviews';
import ProductCard from '@/components/ProductCard';
import { serverGet, SITE_URL } from '@/lib/server';

export const dynamic = 'force-dynamic';
type Props = { params: { slug: string } };

const strip = (h?: string) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await serverGet<{ product: any }>(`/products/${params.slug}`, 0);
  if (!data) return { title: 'Produit introuvable' };
  const p = data.product;
  const desc = p.shortDescription || strip(p.description).slice(0, 160);
  return {
    title: p.name, description: desc, alternates: { canonical: `/produit/${p.slug}` },
    openGraph: { title: p.name, description: desc, type: 'website', images: p.images?.[0]?.url ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const data = await serverGet<{ product: any; related: any[] }>(`/products/${params.slug}`, 0);
  if (!data) notFound();
  const { product: p, related } = data;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.shortDescription || strip(p.description),
    image: (p.images || []).map((i: any) => (i.url.startsWith('http') ? i.url : `${SITE_URL}${i.url}`)),
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    aggregateRating: p.reviews > 0 ? { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews } : undefined,
    offers: { '@type': 'Offer', url: `${SITE_URL}/produit/${p.slug}`, priceCurrency: 'USD', price: p.price.toFixed(2), availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  const specs = Object.entries(p.specs || {});
  return (
    <div className="page-content relative bg-gradient-to-b from-sage-50/50 via-white to-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-pine-900">Accueil</Link><span>/</span>
          <Link href="/boutique" className="hover:text-pine-900">Boutique</Link><span>/</span>
          {p.category && <><Link href={`/boutique?categorie=${p.category}`} className="hover:text-pine-900">{p.categoryName}</Link><span>/</span></>}
          <span className="text-gray-800 font-semibold">{p.name}</span>
        </nav>

        <ProductView product={p} />

        {(p.description || specs.length > 0) && (
          <section className="grid lg:grid-cols-3 gap-6">
            {p.description && (
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-xl font-extrabold text-pine-900 mb-3">Description</h2>
                <div className="prose-viva" dangerouslySetInnerHTML={{ __html: p.description }} />
              </div>
            )}
            {(specs.length > 0 || p.dimensions?.weightKg) && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 h-fit">
                <h2 className="text-xl font-extrabold text-pine-900 mb-3">Caractéristiques</h2>
                <dl className="space-y-2 text-xs">
                  {specs.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-2"><dt className="font-bold text-gray-700">{k}</dt><dd className="text-gray-600 text-right">{String(v)}</dd></div>)}
                  {p.dimensions?.weightKg ? <div className="flex justify-between gap-4 border-b border-gray-100 pb-2"><dt className="font-bold text-gray-700">Poids</dt><dd className="text-gray-600">{p.dimensions.weightKg} kg</dd></div> : null}
                  {p.dimensions?.lengthCm ? <div className="flex justify-between gap-4"><dt className="font-bold text-gray-700">Dimensions</dt><dd className="text-gray-600">{p.dimensions.lengthCm} × {p.dimensions.widthCm} × {p.dimensions.heightCm} cm</dd></div> : null}
                </dl>
              </div>
            )}
          </section>
        )}

        <ProductReviews productId={p.id} distribution={p.ratingDistribution} total={p.ratingDistribution.reduce((a: number, d: any) => a + d.count, 0)} />

        {related?.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-extrabold text-pine-900 tracking-tight">Vous aimerez aussi</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
