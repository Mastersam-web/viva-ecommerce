import Link from 'next/link';
import type { Metadata } from 'next';
import ProductCard from '@/components/ProductCard';
import { serverGet, SITE_URL } from '@/lib/server';
import { getJsonContent } from '@/lib/cms';
import { catIcon, circleLabel } from '@/lib/categories';
import type { Category, Product } from '@/types';

export const metadata: Metadata = {
  title: { absolute: 'VIVA LIVE BETTER - Store Officiel' },
  alternates: { canonical: '/' },
};
export const revalidate = 60;

interface Hero { saleLabel?: string; saleUpTo?: string; saleValue?: string; saleOff?: string; title?: string; subtitle?: string; cta?: string; image?: string }
interface Banner { tag: string; title: string; category: string; image: string; theme?: 'sage' | 'amber' | 'blue' }

const DEFAULT_HERO: Required<Hero> = {
  saleLabel: 'SUMMER SALE', saleUpTo: 'UP TO', saleValue: '40%', saleOff: 'OFF',
  title: 'Elevate Your\nEveryday', subtitle: 'Discover quality products across every category – made for the way you live.', cta: 'Shop Now',
  image: 'https://images.unsplash.com/photo-1581539250439-c96689b516dd?auto=format&fit=crop&w=1600&q=80',
};
const DEFAULT_BANNERS: Banner[] = [
  { tag: 'New Arrivals', title: 'Fresh Styles Just In', category: 'fashion', theme: 'sage', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=300&q=80' },
  { tag: 'Home Refresh', title: 'Make Your Space Better', category: 'home', theme: 'amber', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=300&q=80' },
  { tag: 'Tech Essentials', title: 'Upgrade Your Lifestyle', category: 'electronics', theme: 'blue', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80' },
];
// Les classes sont écrites en toutes lettres pour que Tailwind les détecte.
const THEMES = {
  sage: { box: 'bg-sage-100/80 border-sage-200', tag: 'text-pine-900', title: 'text-pine-900', link: 'text-pine-900' },
  amber: { box: 'bg-amber-50 border-amber-100', tag: 'text-amber-900', title: 'text-amber-950', link: 'text-amber-900' },
  blue: { box: 'bg-blue-50 border-blue-100', tag: 'text-blue-900', title: 'text-blue-950', link: 'text-blue-900' },
};

const REVIEWS = [
  { name: 'Sarah J.', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80', text: '"Amazing quality and fast delivery! Viva has become my go-to store for everything I need."' },
  { name: 'Michael T.', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80', text: '"Great prices, excellent customer service, and super easy returns. Highly recommend!"' },
  { name: 'Priya K.', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', text: '"I love the variety! They have everything and shipping is always so convenient."' },
];

export default async function HomePage() {
  const [featured, fallback, cats, heroCms, bannersCms] = await Promise.all([
    serverGet<{ products: Product[] }>('/products?featured=1&limit=5'),
    serverGet<{ products: Product[] }>('/products?limit=5'),
    serverGet<{ categories: Category[] }>('/categories'),
    getJsonContent<Hero>('hero'),
    getJsonContent<Banner[]>('banners'),
  ]);
  const hero = { ...DEFAULT_HERO, ...(heroCms || {}) };
  const banners = bannersCms?.length ? bannersCms : DEFAULT_BANNERS;
  const products = (featured?.products?.length ? featured.products : fallback?.products) || [];
  const categories = (cats?.categories || []).filter((c) => !c.parent_id);
  const titleLines = hero.title.split('\n');

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'VIVA Live Better', url: SITE_URL,
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/boutique?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };

  return (
    <div className="page-content relative bg-gradient-to-b from-sage-100/40 via-white to-sage-50/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-fixed opacity-[0.03] pointer-events-none"></div>

      {/* HERO BANNER STYLISÉ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10">
        <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 lg:p-14 min-h-[480px] flex flex-col justify-between border border-pine-900/10 shadow-2xl bg-sage-100/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.image} alt="Viva Lifestyle Hero Background" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-sage-50/95 via-sage-100/85 to-transparent sm:to-sage-50/30"></div>

          <div className="absolute top-6 right-6 sm:top-8 sm:right-10 z-10 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl text-center border border-white/80">
            <p className="text-[10px] font-extrabold tracking-widest text-pine-900 uppercase">{hero.saleLabel}</p>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{hero.saleUpTo}</p>
            <p className="text-3xl font-black text-pine-900 leading-tight">{hero.saleValue} <span className="text-xs font-bold uppercase text-amber-500">{hero.saleOff}</span></p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10 my-auto">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-pine-900 tracking-tight leading-[1.05] drop-shadow-xs">
                {titleLines.map((line, i) => (<span key={i}>{line}{i < titleLines.length - 1 && <br />}</span>))}
              </h1>
              <p className="text-gray-700 text-sm sm:text-base max-w-md leading-relaxed font-semibold">{hero.subtitle}</p>

              <div className="pt-2">
                <Link href="/boutique" className="inline-flex items-center gap-3 bg-pine-900 hover:bg-pine-800 text-white font-extrabold px-8 py-3.5 rounded-full transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
                  <span>{hero.cta}</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </Link>
              </div>

              <div className="pt-6 grid grid-cols-3 gap-3 border-t border-pine-900/15 text-[11px] sm:text-xs font-bold text-pine-900 max-w-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-pine-900/10 flex items-center justify-center text-pine-900"><i className="fa-solid fa-shield-check text-xs"></i></div>
                  <span>Premium quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-pine-900/10 flex items-center justify-center text-pine-900"><i className="fa-solid fa-tag text-xs"></i></div>
                  <span>Best prices</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-pine-900/10 flex items-center justify-center text-pine-900"><i className="fa-solid fa-headset text-xs"></i></div>
                  <span>Support 24/7</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY CIRCLE ICONS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between overflow-x-auto gap-4 py-2 hide-scrollbar">
          {categories.map((c) => (
            <Link key={c.id} href={`/boutique?categorie=${c.slug}`} className="flex flex-col items-center min-w-[80px] group">
              <div className="w-16 h-16 rounded-full bg-sage-100 group-hover:bg-pine-900 flex items-center justify-center text-pine-900 group-hover:text-white transition-all duration-300 shadow-sm group-hover:scale-105">
                <i className={`fa-solid ${catIcon(c.icon)} text-xl`}></i>
              </div>
              <span className="text-xs font-semibold text-gray-700 mt-2 group-hover:text-pine-900 whitespace-nowrap">{circleLabel(c.slug, c.name)}</span>
            </Link>
          ))}
          <Link href="/boutique" className="flex flex-col items-center min-w-[80px] group">
            <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-pine-900 flex items-center justify-center text-gray-600 group-hover:text-white transition-all duration-300 border border-dashed border-gray-300">
              <i className="fa-solid fa-ellipsis text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-gray-700 mt-2 group-hover:text-pine-900">Voir tout</span>
          </Link>
        </div>
      </section>

      {/* TOP PICKS FOR YOU SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-pine-900 tracking-tight">Top Picks For You</h2>
            <span className="text-xl">⚡</span>
          </div>
          <Link href="/boutique" className="text-xs sm:text-sm font-bold text-pine-900 hover:text-pine-700 flex items-center gap-1 group">
            <span>Voir tout en boutique</span>
            <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* PROMOTIONAL BANNER GRID (3 Cards) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {banners.slice(0, 3).map((b, i) => {
            const t = THEMES[b.theme || 'sage'] || THEMES.sage;
            return (
              <div key={i} className={`${t.box} rounded-3xl p-6 flex items-center justify-between relative overflow-hidden border group hover:shadow-lg transition`}>
                <div className="space-y-2 z-10 max-w-[60%]">
                  <span className={`text-[10px] font-bold ${t.tag} uppercase tracking-widest bg-white/80 px-2.5 py-1 rounded-full`}>{b.tag}</span>
                  <h3 className={`text-xl font-extrabold ${t.title} leading-tight`}>{b.title}</h3>
                  <Link href={`/boutique?categorie=${b.category}`} className={`inline-flex items-center gap-1.5 text-xs font-bold ${t.link} hover:underline pt-2`}>
                    <span>Shop Now</span>
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </Link>
                </div>
                <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-md flex-shrink-0 group-hover:scale-105 transition duration-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* REVIEWS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-pine-900 tracking-tight flex items-center gap-2">
              Loved By Thousands <span className="text-red-500">❤️</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">Avis vérifiés de nos clients partout dans le monde</p>
          </div>
          <div className="flex items-center gap-2 bg-sage-100 px-4 py-2 rounded-full border border-sage-200">
            <span className="text-xs font-extrabold text-pine-900">Note moyenne 4.9/5</span>
            <div className="text-amber-400 text-xs flex">
              {[0, 1, 2, 3, 4].map((i) => <i key={i} className="fa-solid fa-star"></i>)}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.img} alt={r.name} className="w-11 h-11 rounded-full object-cover" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-gray-900">{r.name}</h4>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <i className="fa-solid fa-check text-[8px]"></i> Vérifié
                    </span>
                  </div>
                  <div className="text-amber-400 text-[10px] flex mt-0.5">
                    {[0, 1, 2, 3, 4].map((i) => <i key={i} className="fa-solid fa-star"></i>)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
