'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { money } from '@/lib/api';

export default function WishlistModal() {
  const { wishlist, wishlistOpen, setWishlistOpen, toggleWishlist } = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setWishlistOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setWishlistOpen]);

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 ${wishlistOpen ? '' : 'hidden'} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b">
          <h3 className="text-lg font-bold text-pine-900 flex items-center gap-2">
            <i className="fa-solid fa-heart text-accent-coral"></i> Liste de Souhaits
          </h3>
          <button onClick={() => setWishlistOpen(false)} aria-label="Fermer" className="text-gray-400 hover:text-black">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        {wishlist.length > 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {wishlist.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b pb-1">
                  <Link href={`/produit/${p.slug}`} onClick={() => setWishlistOpen(false)} className="text-xs font-bold text-gray-800 text-left hover:text-pine-900">
                    • {p.name} - {money(p.price)}
                  </Link>
                  <button onClick={() => toggleWishlist(p)} aria-label="Retirer" className="text-gray-400 hover:text-red-500 text-xs p-1"><i className="fa-solid fa-trash-can"></i></button>
                </div>
              ))}
            </div>
            <Link href="/compte/favoris" onClick={() => setWishlistOpen(false)} className="inline-block mt-4 text-xs font-bold text-pine-900 hover:underline">Gérer mes favoris</Link>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-gray-500">Aucun produit dans vos favoris.</div>
        )}
      </div>
    </div>
  );
}
