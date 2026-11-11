'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/context/StoreContext';
import { money } from '@/lib/api';
import type { Product } from '@/types';

export default function ProductCard({ p }: { p: Product }) {
  const { isWished, toggleWishlist, addToCart, showToast } = useStore();
  const router = useRouter();
  const wished = isWished(p.id);
  const href = `/produit/${p.slug}`;

  const onAdd = () => {
    if (!p.inStock) return showToast('Ce produit est en rupture de stock');
    if (p.hasVariants) { showToast('Choisissez une option pour ce produit'); return router.push(href); }
    addToCart({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col justify-between hover:shadow-xl transition-all duration-300 group relative">
      {!p.inStock ? (
        <span className="absolute top-5 left-5 bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">Épuisé</span>
      ) : p.badge ? (
        <span className="absolute top-5 left-5 bg-accent-coral text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">{p.badge}</span>
      ) : null}
      <button
        onClick={() => toggleWishlist({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image })}
        aria-label={wished ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-accent-coral transition z-10 shadow-sm"
      >
        <i className={`${wished ? 'fa-solid text-accent-coral' : 'fa-regular'} fa-heart text-sm`}></i>
      </button>
      <Link href={href} className="block">
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image || ''} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      </Link>
      <div className="space-y-1">
        <div className="flex items-center text-amber-400 text-[10px] sm:text-xs gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} className={`fa-solid fa-star${i < Math.floor(p.rating) ? '' : ' text-gray-200'}`}></i>
          ))}
          <span className="text-gray-400 text-[10px] ml-1 font-medium">({p.reviews})</span>
        </div>
        <Link href={href} className="block">
          <h3 className="text-xs sm:text-sm font-bold text-gray-800 line-clamp-2 group-hover:text-pine-900 transition">{p.name}</h3>
        </Link>
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-sm sm:text-base font-extrabold text-pine-900">{money(p.price)}</span>
            {p.oldPrice ? <span className="text-xs text-gray-400 line-through ml-1">{money(p.oldPrice)}</span> : null}
          </div>
          <button
            onClick={onAdd}
            aria-label={`Ajouter ${p.name} au panier`}
            className={`w-8 h-8 bg-sage-100 hover:bg-pine-900 text-pine-900 hover:text-white rounded-full flex items-center justify-center transition shadow-sm ${p.inStock ? '' : 'opacity-40'}`}
          >
            <i className="fa-solid fa-plus text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
