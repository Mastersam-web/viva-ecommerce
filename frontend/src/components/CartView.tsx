'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/context/StoreContext';
import { Alert, btnPrimary, card, inputCls } from './ui';

export default function CartView() {
  const { user, authReady, cart, changeQty, removeFromCart, showToast, settings } = useStore();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [code, setCode] = useState(''); const [applied, setApplied] = useState('');
  const country = settings['store.default_country'] || 'FR';

  useEffect(() => {
    if (!cart.length) { setQuote(null); return; }
    const t = setTimeout(() => {
      api.post('/cart/quote', { items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, quantity: c.qty })), couponCode: applied || undefined, country })
        .then(setQuote).catch(() => setQuote(null));
    }, 250);
    return () => clearTimeout(t);
  }, [cart, applied, country]);

  const apply = (e: FormEvent) => { e.preventDefault(); if (code.trim()) setApplied(code.trim().toUpperCase()); };
  const remaining = quote && settings['store.free_shipping_threshold'] ? Number(settings['store.free_shipping_threshold']) - (quote.subtotal - quote.discount) : 0;
  const blocked = !!quote?.issues?.length;

  if (authReady && !user) return (
    <div className={`${card} p-12 text-center space-y-4`}>
      <i className="fa-solid fa-lock text-4xl text-sage-300"></i>
      <p className="text-sm text-gray-600">Connectez-vous ou créez un compte pour utiliser votre panier.</p>
      <div className="flex gap-3 justify-center">
        <Link href="/connexion?next=/panier" className={`${btnPrimary} inline-block`}>Se connecter</Link>
        <Link href="/inscription?next=/panier" className="inline-block border border-pine-900 text-pine-900 font-bold px-6 py-3 rounded-full text-sm">Créer un compte</Link>
      </div>
    </div>
  );

  if (!cart.length) return (
    <div className={`${card} p-12 text-center space-y-4`}>
      <i className="fa-solid fa-bag-shopping text-4xl text-sage-300"></i>
      <p className="text-sm text-gray-600">Votre panier est vide.</p>
      <Link href="/boutique" className={`${btnPrimary} inline-block`}>Continuer mes achats</Link>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className={`lg:col-span-2 ${card} p-6 space-y-4`}>
        {cart.map((it) => {
          const line = quote?.lines?.find((l: any) => l.productId === it.id && l.variantId === it.variantId);
          const issue = quote?.issues?.find((i: any) => i.productId === it.id);
          return (
            <div key={`${it.id}:${it.variantId}`} className="flex items-center gap-4 border-b border-gray-100 pb-4 last:border-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image} alt={it.name} className="w-20 h-20 rounded-2xl object-cover bg-gray-100" />
              <div className="flex-1 space-y-1">
                <Link href={`/produit/${it.slug}`} className="text-sm font-bold text-gray-800 hover:text-pine-900">{it.name}</Link>
                {it.variantName && <p className="text-xs text-gray-500">{it.variantName}</p>}
                <p className="text-xs text-pine-900 font-extrabold">{money(line?.unitPrice ?? it.price)} <span className="text-gray-400 font-medium">l'unité</span></p>
                {issue && <p className="text-[11px] font-bold text-red-600">{issue.message}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => changeQty(it.id, it.variantId, -1)} aria-label="Diminuer" className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-bold">-</button>
                  <span className="text-xs font-semibold w-6 text-center">{it.qty}</span>
                  <button onClick={() => changeQty(it.id, it.variantId, 1)} aria-label="Augmenter" className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-bold">+</button>
                </div>
              </div>
              <div className="text-right space-y-2">
                <p className="text-sm font-extrabold text-pine-900">{money((line?.unitPrice ?? it.price) * it.qty)}</p>
                <button onClick={() => removeFromCart(it.id, it.variantId)} aria-label="Supprimer" className="text-gray-400 hover:text-red-500 text-xs"><i className="fa-solid fa-trash-can"></i></button>
              </div>
            </div>
          );
        })}
        <Link href="/boutique" className="inline-flex items-center gap-2 text-xs font-bold text-pine-900 hover:underline"><i className="fa-solid fa-arrow-left"></i> Continuer mes achats</Link>
      </div>

      <aside className={`${card} p-6 space-y-4 h-fit lg:sticky lg:top-40`}>
        <h2 className="text-lg font-extrabold text-pine-900">Récapitulatif</h2>
        <form onSubmit={apply} className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code promo" aria-label="Code promotionnel" className={`${inputCls} uppercase`} />
          <button className="bg-sage-100 hover:bg-sage-200 text-pine-900 font-bold px-4 rounded-xl text-xs">Appliquer</button>
        </form>
        {quote?.couponError && <Alert>{quote.couponError}</Alert>}
        {quote?.couponCode && <Alert kind="success">Code {quote.couponCode} appliqué <button onClick={() => { setApplied(''); setCode(''); }} className="underline ml-1">retirer</button></Alert>}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-600">Sous-total</dt><dd className="font-bold">{money(quote?.subtotal ?? cart.reduce((a, i) => a + i.price * i.qty, 0))}</dd></div>
          {quote?.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Remise</dt><dd className="font-bold">- {money(quote.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-gray-600">Livraison estimée</dt><dd className="font-bold">{quote ? (quote.shipping === 0 ? 'Gratuite' : money(quote.shipping)) : '—'}</dd></div>
          {quote?.tax > 0 && <div className="flex justify-between"><dt className="text-gray-600">Taxes</dt><dd className="font-bold">{money(quote.tax)}</dd></div>}
          <div className="flex justify-between border-t pt-3 text-base font-extrabold text-gray-900"><dt>Total</dt><dd>{money(quote?.grandTotal ?? cart.reduce((a, i) => a + i.price * i.qty, 0))}</dd></div>
        </dl>
        {remaining > 0 && quote?.shipping > 0 && <p className="text-[11px] text-emerald-700 font-bold"><i className="fa-solid fa-truck-fast mr-1"></i>Plus que {money(remaining)} pour la livraison gratuite !</p>}
        {blocked && <Alert>Certains produits ne sont plus disponibles en quantité suffisante. Ajustez votre panier.</Alert>}
        <button disabled={blocked} onClick={() => { showToast('Redirection vers le paiement sécurisé...'); router.push('/commande'); }} className={`${btnPrimary} w-full`}>Passer la commande</button>
      </aside>
    </div>
  );
}
