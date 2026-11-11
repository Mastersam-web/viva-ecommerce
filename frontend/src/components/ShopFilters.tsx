'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { qs } from '@/lib/api';
import { tabLabel } from '@/lib/categories';
import type { Category } from '@/types';

export interface ShopParams { categorie?: string; q?: string; sort?: string; minPrice?: string; maxPrice?: string; brand?: string; inStock?: string; minRating?: string; page?: string }

const sel = 'bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:border-pine-900';
const field = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pine-900';

export default function ShopFilters({ categories, brands, params }: { categories: Category[]; brands: { slug: string; name: string }[]; params: ShopParams }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!(params.minPrice || params.maxPrice || params.brand || params.inStock || params.minRating));
  const [draft, setDraft] = useState({ minPrice: params.minPrice || '', maxPrice: params.maxPrice || '', brand: params.brand || '', inStock: params.inStock === '1', minRating: params.minRating || '' });

  const push = (patch: Partial<ShopParams>) => {
    const next = { ...params, ...patch, page: patch.page ?? undefined };
    router.push(`/boutique${qs(next)}`);
  };
  const active = params.categorie || 'All';
  const tabs = [{ slug: 'All', label: 'Tout voir' }, ...categories.filter((c) => !c.parent_id).map((c) => ({ slug: c.slug, label: tabLabel(c.slug, c.name) }))];
  const hasFilters = !!(params.minPrice || params.maxPrice || params.brand || params.inStock || params.minRating);

  return (
    <div className="mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto">
          {tabs.map((t) => (
            <button key={t.slug} onClick={() => push({ categorie: t.slug === 'All' ? undefined : t.slug })}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${active === t.slug ? 'bg-pine-900 text-white' : 'bg-white text-gray-700 hover:bg-sage-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select value={params.sort || ''} onChange={(e) => push({ sort: e.target.value || undefined })} aria-label="Trier" className={sel}>
            <option value="">Pertinence</option>
            <option value="popular">Popularité</option>
            <option value="newest">Nouveautés</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
            <option value="rating">Mieux notés</option>
          </select>
          <button onClick={() => setOpen((o) => !o)} className={`${sel} flex items-center gap-2 hover:bg-sage-200 ${hasFilters ? 'border-pine-900 text-pine-900' : ''}`}>
            <i className="fa-solid fa-sliders text-[10px]"></i> Filtres
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); push({ minPrice: draft.minPrice || undefined, maxPrice: draft.maxPrice || undefined, brand: draft.brand || undefined, inStock: draft.inStock ? '1' : undefined, minRating: draft.minRating || undefined }); }}
          className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end border-t border-gray-100 pt-4">
          <div><label className="text-[11px] font-bold text-gray-600">Prix min ($)</label><input type="number" min="0" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} className={field} /></div>
          <div><label className="text-[11px] font-bold text-gray-600">Prix max ($)</label><input type="number" min="0" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} className={field} /></div>
          <div><label className="text-[11px] font-bold text-gray-600">Marque</label>
            <select value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className={field}><option value="">Toutes</option>{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
          <div><label className="text-[11px] font-bold text-gray-600">Note minimum</label>
            <select value={draft.minRating} onChange={(e) => setDraft({ ...draft, minRating: e.target.value })} className={field}><option value="">Toutes</option><option value="4.5">4.5 ★ et +</option><option value="4">4 ★ et +</option><option value="3">3 ★ et +</option></select></div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 pb-2"><input type="checkbox" checked={draft.inStock} onChange={(e) => setDraft({ ...draft, inStock: e.target.checked })} className="accent-pine-900" /> En stock</label>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-pine-900 hover:bg-pine-800 text-white text-xs font-bold px-4 py-2 rounded-full transition">Appliquer</button>
            {hasFilters && <button type="button" onClick={() => { setDraft({ minPrice: '', maxPrice: '', brand: '', inStock: false, minRating: '' }); push({ minPrice: undefined, maxPrice: undefined, brand: undefined, inStock: undefined, minRating: undefined }); }} className="text-xs font-bold text-gray-500 hover:text-pine-900">Réinitialiser</button>}
          </div>
        </form>
      )}
    </div>
  );
}
