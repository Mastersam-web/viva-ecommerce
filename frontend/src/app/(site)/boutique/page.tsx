import type { Metadata } from 'next';
import ProductCard from '@/components/ProductCard';
import ShopFilters, { ShopParams } from '@/components/ShopFilters';
import Pagination from '@/components/Pagination';
import { serverGet } from '@/lib/server';
import { qs } from '@/lib/api';
import type { Category, Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: ShopParams }): Promise<Metadata> {
  const cats = (await serverGet<{ categories: Category[] }>('/categories'))?.categories || [];
  const cat = cats.find((c) => c.slug === searchParams.categorie);
  const title = searchParams.q ? `Recherche : ${searchParams.q}` : cat ? cat.name : 'Notre Boutique';
  return {
    title,
    description: cat ? `Découvrez notre sélection ${cat.name} chez VIVA Live Better.` : 'Parcourez notre gamme complète de produits soigneusement sélectionnés pour élever votre style de vie.',
    alternates: { canonical: cat && !searchParams.q ? `/boutique?categorie=${cat.slug}` : '/boutique' },
    robots: searchParams.q || searchParams.minPrice || searchParams.maxPrice || searchParams.brand ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: ShopParams }) {
  const apiParams = { category: searchParams.categorie, q: searchParams.q, sort: searchParams.sort, minPrice: searchParams.minPrice, maxPrice: searchParams.maxPrice, brand: searchParams.brand, inStock: searchParams.inStock, minRating: searchParams.minRating, page: searchParams.page, limit: 12 };
  const [list, cats, brands] = await Promise.all([
    serverGet<{ products: Product[]; meta: { total: number; page: number; pages: number } }>(`/products${qs(apiParams)}`, 0),
    serverGet<{ categories: Category[] }>('/categories'),
    serverGet<{ brands: { slug: string; name: string }[] }>('/brands'),
  ]);
  const products = list?.products || [];
  const meta = list?.meta || { total: 0, page: 1, pages: 1 };

  return (
    <div className="page-content relative bg-gradient-to-b from-sage-50/50 via-white to-gray-50 min-h-screen">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-fixed opacity-[0.03] pointer-events-none"></div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* En-tête Boutique avec Arrière-plan Stylisé */}
        <div className="relative rounded-3xl p-8 sm:p-12 mb-8 overflow-hidden border border-pine-900/10 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1600&q=80" alt="Shop Background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950/90 via-pine-900/80 to-transparent"></div>

          <div className="relative z-10 space-y-3 max-w-xl text-white">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-widest backdrop-blur-md">Catalogue Complet</span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">Notre Boutique</h1>
            <p className="text-sage-200 text-xs sm:text-sm font-medium leading-relaxed">
              Parcourez notre gamme complète de produits soigneusement sélectionnés pour élever votre style de vie.
            </p>
          </div>
        </div>

        {/* Filtres par Catégories (+ tri et filtres du cahier des charges) */}
        <ShopFilters categories={cats?.categories || []} brands={brands?.brands || []} params={searchParams} />

        {searchParams.q && <p className="text-xs text-gray-500 mb-4">{meta.total} résultat(s) pour « {searchParams.q} »</p>}

        {/* Grille de Produits Boutique */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.length ? products.map((p) => <ProductCard key={p.id} p={p} />) : (
            <p className="col-span-full text-center text-sm text-gray-500 py-8">
              {searchParams.q ? `Aucun produit ne correspond à "${searchParams.q}".` : 'Aucun produit dans cette sélection.'}
            </p>
          )}
        </div>

        <Pagination base="/boutique" params={{ ...searchParams, page: undefined }} page={meta.page} pages={meta.pages} />
      </section>
    </div>
  );
}
