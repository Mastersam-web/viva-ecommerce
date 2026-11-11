'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { money } from '@/lib/api';
import { useAnimatedToggle } from '@/lib/useAnimatedToggle';

export default function CartDrawer() {
  const { user, cart, cartSubtotal, cartOpen, setCartOpen, changeQty, removeFromCart, showToast } = useStore();
  const { mounted, shown } = useAnimatedToggle(cartOpen);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCartOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCartOpen]);

  const checkout = () => {
    if (!user) { setCartOpen(false); router.push('/connexion?next=/commande'); return; }
    if (cart.length === 0) { showToast('Votre panier est vide !'); return; }
    showToast('Redirection vers le paiement sécurisé...');
    setCartOpen(false);
    router.push('/commande');
  };

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 ${mounted ? '' : 'hidden'} ${shown ? '' : 'opacity-0'} transition-opacity duration-300`}>
      <div className={`bg-white w-full max-w-md h-full ml-auto p-6 overflow-y-auto flex flex-col justify-between transform ${shown ? '' : 'translate-x-full'} transition-transform duration-300`}>
        <div>
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-lg font-bold text-pine-900 flex items-center gap-2">
              <i className="fa-solid fa-bag-shopping"></i> Mon Panier
            </h3>
            <button onClick={() => setCartOpen(false)} aria-label="Fermer le panier" className="text-gray-400 hover:text-black">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          <div className="py-4 space-y-4">
            {!user ? (
              <div className="text-center py-8 space-y-3">
                <i className="fa-solid fa-lock text-3xl text-pine-900"></i>
                <p className="text-sm text-gray-600">Un compte est nécessaire pour utiliser le panier.</p>
                <Link href="/connexion?next=/panier" onClick={() => setCartOpen(false)} className="block bg-pine-900 hover:bg-pine-800 text-white font-bold py-3 rounded-full text-sm">Se connecter</Link>
                <Link href="/inscription?next=/panier" onClick={() => setCartOpen(false)} className="block text-xs font-bold text-pine-900 hover:underline">Créer un compte</Link>
              </div>
            ) : cart.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Votre panier est vide.</p>
            ) : cart.map((item) => (
              <div key={`${item.id}:${item.variantId}`} className="flex items-center gap-3 border-b pb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} className="w-14 h-14 object-cover rounded-xl bg-gray-100" alt={item.name} />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-800">{item.name}{item.variantName ? <span className="font-medium text-gray-500"> - {item.variantName}</span> : null}</h4>
                  <p className="text-xs text-pine-900 font-extrabold">{money(item.price)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => changeQty(item.id, item.variantId, -1)} aria-label="Diminuer" className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-xs font-bold">-</button>
                    <span className="text-xs font-semibold">{item.qty}</span>
                    <button onClick={() => changeQty(item.id, item.variantId, 1)} aria-label="Augmenter" className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-xs font-bold">+</button>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.id, item.variantId)} aria-label="Supprimer" className="text-gray-400 hover:text-red-500 text-xs p-1">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between font-extrabold text-gray-900 text-base">
            <span>Sous-total:</span>
            <span>{money(cartSubtotal)}</span>
          </div>
          <button onClick={checkout} className="w-full bg-pine-900 hover:bg-pine-800 text-white font-bold py-3.5 rounded-full transition text-sm">
            Commander maintenant
          </button>
          <Link href="/panier" onClick={() => setCartOpen(false)} className="block text-center text-xs font-bold text-pine-900 hover:underline">
            Voir mon panier (code promo, livraison)
          </Link>
        </div>
      </div>
    </div>
  );
}
