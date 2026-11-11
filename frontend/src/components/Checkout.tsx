'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/context/StoreContext';
import { Alert, Field, Spinner, btnPrimary, card, inputCls } from './ui';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const EMPTY = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'FR' };
const METHOD_ICON: Record<string, string> = { cod: 'fa-money-bill-wave', card: 'fa-credit-card', mobile_money: 'fa-mobile-screen', bank_transfer: 'fa-building-columns' };
const METHOD_TEXT: Record<string, string> = { cod: 'Vous payez à la réception de votre colis.', card: 'Paiement sécurisé via notre prestataire agréé. Aucune donnée de carte n\'est conservée.', mobile_money: 'Paiement depuis votre téléphone, confirmé automatiquement.', bank_transfer: 'Commande confirmée à réception du virement.' };

export default function Checkout() {
  const { cart, user, authReady, clearCart, showToast, settings } = useStore();
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState<number | 'new'>('new');
  const [addr, setAddr] = useState({ ...EMPTY, country: settings['store.default_country'] || 'FR' });
  const [methods, setMethods] = useState<any[]>([]);
  const [payMethods, setPayMethods] = useState<any[]>([]);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [payment, setPayment] = useState('');
  const [code, setCode] = useState(''); const [applied, setApplied] = useState('');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const key = useRef(newKey());

  useEffect(() => { if (authReady && !user) router.replace('/connexion?next=/commande'); }, [authReady, user, router]);
  useEffect(() => {
    if (!user) return;
    Promise.all([api.get('/account/addresses'), api.get('/settings')]).then(([a, s]) => {
      setAddresses(a.addresses);
      const def = a.addresses.find((x: any) => x.is_default) || a.addresses[0];
      if (def) setAddressId(def.id); else setAddr((x) => ({ ...x, full_name: `${user.first_name} ${user.last_name}`, phone: user.phone || '' }));
      setPayMethods(s.paymentMethods);
      setPayment(s.paymentMethods[0]?.code || '');
    }).finally(() => setLoading(false));
  }, [user]);

  const country = addressId === 'new' ? addr.country : addresses.find((a) => a.id === addressId)?.country || 'FR';

  // Devis serveur : prix, stock, promo, livraison (source de vérité)
  useEffect(() => {
    if (!cart.length) { setQuote(null); return; }
    const t = setTimeout(() => {
      api.post('/cart/quote', { items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, quantity: c.qty })), couponCode: applied || undefined, shippingMethodId: shippingId || undefined, country })
        .then((q) => {
          setQuote(q); setMethods(q.shippingMethods);
          if (!q.shippingMethods.some((m: any) => m.id === shippingId)) setShippingId(q.shippingMethods[0]?.id || null);
        }).catch(() => null);
    }, 200);
    return () => clearTimeout(t);
  }, [cart, applied, shippingId, country]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (!cart.length) return setErr('Votre panier est vide');
    if (!shippingId) return setErr('Aucun mode de livraison disponible pour cette adresse');
    if (!payment) return setErr('Choisissez un moyen de paiement');
    setBusy(true);
    try {
      const body: any = { items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, quantity: c.qty })), shippingMethodId: shippingId, paymentMethod: payment, couponCode: applied || undefined, notes: notes || undefined, idempotencyKey: key.current };
      if (addressId === 'new') body.address = { ...addr, line2: addr.line2 || null, state: addr.state || null, postal_code: addr.postal_code || null };
      else body.addressId = addressId;
      const r = await api.post('/orders', body);
      if (r.instructions) try { sessionStorage.setItem(`viva_instr_${r.order.id}`, JSON.stringify(r.instructions)); } catch { /* ignore */ }
      clearCart();
      const ins = r.instructions;
      if (ins?.type === 'redirect') {
        const url: string = ins.url;
        if (url.startsWith(window.location.origin)) router.push(url.slice(window.location.origin.length)); else window.location.href = url;
      } else if (ins?.type === 'page') router.push(ins.url || `/commande/paiement?order=${r.order.id}`);
      else router.push(`/commande/confirmation?order=${r.order.id}`);
    } catch (e: any) {
      key.current = newKey();
      setErr(e.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  };

  if (!authReady || !user || loading) return <Spinner />;
  if (!cart.length) return <div className={`${card} p-12 text-center space-y-4`}><p className="text-sm text-gray-600">Votre panier est vide.</p><Link href="/boutique" className={`${btnPrimary} inline-block`}>Continuer mes achats</Link></div>;

  const set = (k: string) => (e: any) => setAddr({ ...addr, [k]: e.target.value });
  const section = (n: number, title: string) => <h2 className="text-lg font-extrabold text-pine-900 flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-pine-900 text-white text-xs flex items-center justify-center">{n}</span>{title}</h2>;

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        {err && <Alert>{err}</Alert>}
        {quote?.issues?.length > 0 && <Alert>{quote.issues.map((i: any) => i.message).join(' · ')} — <Link href="/panier" className="underline">modifier le panier</Link></Alert>}

        <section className={`${card} p-6 space-y-4`}>
          {section(1, 'Adresse de livraison')}
          {addresses.map((a) => (
            <label key={a.id} className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer ${addressId === a.id ? 'border-pine-900 bg-sage-50' : 'border-gray-200'}`}>
              <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-pine-900" />
              <span className="text-xs text-gray-700"><b className="text-gray-900">{a.full_name}</b>{a.label ? ` (${a.label})` : ''}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.postal_code} {a.city}, {a.country}{a.phone ? ` · ${a.phone}` : ''}</span>
            </label>
          ))}
          <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer ${addressId === 'new' ? 'border-pine-900 bg-sage-50' : 'border-gray-200'}`}>
            <input type="radio" name="addr" checked={addressId === 'new'} onChange={() => setAddressId('new')} className="accent-pine-900" /><span className="text-xs font-bold text-gray-800">Nouvelle adresse</span>
          </label>
          {addressId === 'new' && (
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <Field label="Nom complet"><input required value={addr.full_name} onChange={set('full_name')} className={inputCls} /></Field>
              <Field label="Téléphone"><input required value={addr.phone} onChange={set('phone')} className={inputCls} /></Field>
              <div className="sm:col-span-2"><Field label="Adresse"><input required value={addr.line1} onChange={set('line1')} className={inputCls} /></Field></div>
              <div className="sm:col-span-2"><Field label="Complément (facultatif)"><input value={addr.line2} onChange={set('line2')} className={inputCls} /></Field></div>
              <Field label="Ville"><input required value={addr.city} onChange={set('city')} className={inputCls} /></Field>
              <Field label="Code postal"><input value={addr.postal_code} onChange={set('postal_code')} className={inputCls} /></Field>
              <Field label="Région / État"><input value={addr.state} onChange={set('state')} className={inputCls} /></Field>
              <Field label="Pays (code à 2 lettres)"><input required maxLength={2} minLength={2} value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value.toUpperCase() })} className={inputCls} placeholder="FR" /></Field>
            </div>
          )}
        </section>

        <section className={`${card} p-6 space-y-4`}>
          {section(2, 'Mode de livraison')}
          {methods.length === 0 && <Alert>Aucune livraison disponible vers ce pays.</Alert>}
          {methods.map((m) => (
            <label key={m.id} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border cursor-pointer ${shippingId === m.id ? 'border-pine-900 bg-sage-50' : 'border-gray-200'}`}>
              <span className="flex items-center gap-3"><input type="radio" name="ship" checked={shippingId === m.id} onChange={() => setShippingId(m.id)} className="accent-pine-900" />
                <span className="text-xs"><b className="text-gray-900">{m.name}</b><br /><span className="text-gray-500">Livraison estimée : {m.minDays} à {m.maxDays} jours</span></span></span>
              <b className="text-sm text-pine-900">{m.price === 0 ? 'Gratuite' : money(m.price)}</b>
            </label>
          ))}
        </section>

        <section className={`${card} p-6 space-y-4`}>
          {section(3, 'Moyen de paiement')}
          {payMethods.map((m) => (
            <label key={m.code} className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer ${payment === m.code ? 'border-pine-900 bg-sage-50' : 'border-gray-200'}`}>
              <input type="radio" name="pay" checked={payment === m.code} onChange={() => setPayment(m.code)} className="mt-1 accent-pine-900" />
              <span className="text-xs"><b className="text-gray-900"><i className={`fa-solid ${METHOD_ICON[m.code] || 'fa-wallet'} mr-2 text-pine-900`}></i>{m.label}</b><br /><span className="text-gray-500">{m.description || METHOD_TEXT[m.code]}</span></span>
            </label>
          ))}
          <Field label="Instructions pour la livraison (facultatif)"><textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </section>
      </div>

      <aside className={`${card} p-6 space-y-4 h-fit lg:sticky lg:top-40`}>
        <h2 className="text-lg font-extrabold text-pine-900">Récapitulatif</h2>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {(quote?.lines || []).map((l: any) => (
            <div key={`${l.productId}:${l.variantId}`} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
              <div className="flex-1 text-xs"><p className="font-bold text-gray-800 line-clamp-1">{l.name}</p><p className="text-gray-500">{l.variantName ? `${l.variantName} · ` : ''}Qté {l.quantity}</p></div>
              <b className="text-xs text-pine-900">{money(l.lineTotal)}</b>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code promo" aria-label="Code promotionnel" className={`${inputCls} uppercase`} />
          <button type="button" onClick={() => code.trim() && setApplied(code.trim().toUpperCase())} className="bg-sage-100 hover:bg-sage-200 text-pine-900 font-bold px-4 rounded-xl text-xs">OK</button>
        </div>
        {quote?.couponError && <Alert>{quote.couponError}</Alert>}
        {quote?.couponCode && <Alert kind="success">Code {quote.couponCode} appliqué <button type="button" onClick={() => { setApplied(''); setCode(''); }} className="underline ml-1">retirer</button></Alert>}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-600">Sous-total</dt><dd className="font-bold">{money(quote?.subtotal)}</dd></div>
          {quote?.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Remise</dt><dd className="font-bold">- {money(quote.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-gray-600">Livraison</dt><dd className="font-bold">{quote?.shipping === 0 ? 'Gratuite' : money(quote?.shipping)}</dd></div>
          {quote?.tax > 0 && <div className="flex justify-between"><dt className="text-gray-600">Taxes</dt><dd className="font-bold">{money(quote.tax)}</dd></div>}
          <div className="flex justify-between border-t pt-3 text-base font-extrabold text-gray-900"><dt>Total</dt><dd>{money(quote?.grandTotal)}</dd></div>
        </dl>
        <button disabled={busy || !quote || quote.issues?.length > 0} className={`${btnPrimary} w-full`}>{busy ? 'Validation…' : 'Confirmer la commande'}</button>
        <p className="text-[11px] text-gray-400 text-center"><i className="fa-solid fa-lock mr-1"></i>Paiement 100% sécurisé. En commandant, vous acceptez nos <Link href="/conditions-generales" className="underline">CGV</Link>.</p>
      </aside>
    </form>
  );
}
