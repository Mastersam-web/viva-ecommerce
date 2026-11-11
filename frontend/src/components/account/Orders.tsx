'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, dateFr, money } from '@/lib/api';
import { METHOD, ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS } from '@/lib/labels';
import { useStore } from '@/context/StoreContext';
import Badge from '../Badge';
import Timeline from '../Timeline';
import Pagination from '../Pagination';
import { Alert, Field, Spinner, btnPrimary, btnSecondary, card, inputCls } from '../ui';

function ListInner() {
  const sp = useSearchParams(); const router = useRouter();
  const page = Number(sp.get('page') || 1); const status = sp.get('status') || '';
  const [data, setData] = useState<any>(null);
  useEffect(() => { setData(null); api.get(`/orders?page=${page}&limit=10${status ? `&status=${status}` : ''}`).then(setData); }, [page, status]);
  return (
    <>
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold text-pine-900">Mes commandes</h2>
        <select aria-label="Filtrer par statut" value={status} onChange={(e) => router.push(`/compte/commandes${e.target.value ? `?status=${e.target.value}` : ''}`)} className={`${inputCls} !w-auto`}>
          <option value="">Tous les statuts</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
      {!data ? <Spinner /> : data.orders.length === 0 ? <div className={`${card} p-10 text-center text-sm text-gray-500`}>Aucune commande.</div> : (
        <div className="space-y-3">{data.orders.map((o: any) => (
          <Link key={o.id} href={`/compte/commandes/${o.id}`} className={`${card} p-4 flex items-center gap-4 hover:shadow-md transition`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {o.image ? <img src={o.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100" /> : <span className="w-14 h-14 rounded-xl bg-gray-100" />}
            <div className="flex-1 min-w-0 text-xs"><b className="text-gray-900 block">{o.order_number}</b><span className="text-gray-500">{dateFr(o.created_at)} · {o.item_count} article(s)</span></div>
            <div className="text-right space-y-1"><Badge map={ORDER_STATUS} value={o.status} /><b className="block text-sm text-pine-900">{money(o.grand_total)}</b></div>
          </Link>))}
          <Pagination base="/compte/commandes" params={{ status: status || undefined }} page={data.meta.page} pages={data.meta.pages} />
        </div>)}
    </>
  );
}
export const OrdersList = () => <Suspense fallback={<Spinner />}><ListInner /></Suspense>;

function ReturnForm({ order, onDone }: { order: any; onDone: () => void }) {
  const [item, setItem] = useState(''); const [qty, setQty] = useState(1); const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const { showToast } = useStore();
  const avail = order.items.filter((i: any) => i.quantity - Number(i.returned_qty) > 0);
  const sel = avail.find((i: any) => String(i.id) === item);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/returns', { orderId: order.id, orderItemId: Number(item), quantity: qty, reason, details: details || undefined }); showToast('Demande de retour envoyée'); onDone(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  if (!avail.length) return <p className="text-xs text-gray-500">Tous les articles ont déjà fait l'objet d'une demande de retour.</p>;
  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <Field label="Article"><select required value={item} onChange={(e) => { setItem(e.target.value); setQty(1); }} className={inputCls}><option value="">Choisir…</option>{avail.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      {sel && <Field label="Quantité"><input type="number" min={1} max={sel.quantity - Number(sel.returned_qty)} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={inputCls} /></Field>}
      <Field label="Motif"><input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Produit défectueux, ne convient pas…" className={inputCls} /></Field>
      <Field label="Détails (facultatif)"><textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className={inputCls} /></Field>
      <button disabled={busy} className={btnPrimary}>Envoyer la demande</button>
    </form>
  );
}

function DetailInner({ id }: { id: string }) {
  const sp = useSearchParams(); const { showToast } = useStore();
  const [o, setO] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ret, setRet] = useState(false); 
  const load = useCallback(() => api.get(`/orders/${id}`).then((r) => setO(r.order)).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<any>, okMsg?: string) => { setBusy(true); setErr(''); try { const r = await fn(); if (okMsg) showToast(okMsg); await load(); return r; } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const cancel = () => {
    const reason = window.prompt("Demande d'annulation : indiquez le motif (facultatif). Seul notre équipe peut modifier le statut de la commande.");
    if (reason === null) return;
    return act(() => api.post(`/orders/${id}/cancel-request`, { reason: reason || undefined }), "Demande d'annulation envoyée : vous serez notifié de la réponse");
  };
  if (err && !o) return <Alert>{err}</Alert>;
  if (!o) return <Spinner />;
  const a = o.shipping_address || {}; const pay0 = o.payments[0];
  return (
    <>
      <Link href="/compte/commandes" className="text-xs font-bold text-accent-600"><i className="fa-solid fa-arrow-left mr-1"></i>Mes commandes</Link>
      {sp.get('paiement') === 'ok' && <Alert kind="success">Paiement reçu, merci !</Alert>}
      {sp.get('paiement') === 'echec' && <Alert>Le paiement a échoué. Vous pouvez réessayer ci-dessous.</Alert>}
      {err && <Alert>{err}</Alert>}
      <section className={`${card} p-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-pine-900">{o.order_number}</h2><p className="text-xs text-gray-500">Passée le {dateFr(o.created_at, true)}</p></div>
          <div className="flex gap-2"><Badge map={ORDER_STATUS} value={o.status} /><Badge map={PAYMENT_STATUS} value={o.payment_status} /></div></div>
        <div className="flex flex-wrap gap-2">
          {o.invoice && <a href={`/api/orders/${o.id}/invoice.pdf`} target="_blank" rel="noreferrer" className={btnSecondary}><i className="fa-solid fa-file-pdf mr-2"></i>Facture</a>}
          {o.payment_status === 'paid' && <a href={`/api/orders/${o.id}/receipt.pdf`} target="_blank" rel="noreferrer" className={btnSecondary}><i className="fa-solid fa-receipt mr-2"></i>Reçu</a>}
          {o.canRequestCancel && <button disabled={busy} onClick={cancel} className="bg-red-50 text-red-700 font-bold py-2.5 px-6 rounded-full text-sm hover:bg-red-100">Demander l'annulation</button>}
          {o.canReturn && <button onClick={() => setRet(!ret)} className={btnSecondary}>Demander un retour</button>}
        </div>
        {o.canPay && <div className="flex flex-wrap gap-3 items-center bg-amber-50 rounded-2xl p-4"><span className="text-xs font-bold text-amber-800">{pay0?.proof_submitted_at ? 'Paiement en cours de vérification' : 'Paiement en attente'}</span>
          <Link href={`/commande/paiement?order=${o.id}`} className={`${btnPrimary} !py-2`}>{pay0?.proof_submitted_at ? 'Voir le paiement' : 'Payer maintenant'}</Link></div>}
        <p className="text-[11px] text-gray-500"><i className="fa-solid fa-bell mr-1"></i>Le statut de votre commande est mis à jour par notre équipe : vous êtes notifié à chaque changement.</p>
        {ret && <div className="border-t pt-4"><ReturnForm order={o} onDone={() => { setRet(false); load(); }} /></div>}
      </section>
      <section className={`${card} p-6`}>
        <h3 className="font-extrabold text-pine-900 mb-3">Articles</h3>
        <ul className="divide-y">{o.items.map((i: any) => (
          <li key={i.id} className="py-3 flex items-center gap-3 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {i.image && <img src={i.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />}
            <div className="flex-1"><b className="text-gray-900">{i.name}</b>{i.variant_name && <span className="text-gray-500"> · {i.variant_name}</span>}<br /><span className="text-gray-500">{money(i.unit_price)} × {i.quantity}</span></div>
            <b>{money(i.line_total)}</b></li>))}</ul>
        <dl className="text-sm space-y-1 mt-4 border-t pt-4 max-w-xs ml-auto">
          <div className="flex justify-between"><dt>Sous-total</dt><dd>{money(o.subtotal)}</dd></div>
          {Number(o.discount_total) > 0 && <div className="flex justify-between text-emerald-700"><dt>Remise</dt><dd>- {money(o.discount_total)}</dd></div>}
          <div className="flex justify-between"><dt>Livraison</dt><dd>{money(o.shipping_total)}</dd></div>
          {Number(o.tax_total) > 0 && <div className="flex justify-between"><dt>Taxes</dt><dd>{money(o.tax_total)}</dd></div>}
          <div className="flex justify-between font-extrabold border-t pt-2"><dt>Total</dt><dd>{money(o.grand_total)}</dd></div></dl>
      </section>
      <div className="grid md:grid-cols-2 gap-6">
        <section className={`${card} p-6 text-xs space-y-1`}><h3 className="font-extrabold text-pine-900 text-sm mb-2">Livraison</h3>
          <p className="font-bold text-gray-900">{a.full_name}</p><p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p><p>{a.postal_code} {a.city}, {a.country}</p>{a.phone && <p>{a.phone}</p>}
          {o.shipment && <p className="pt-2">N° de suivi : <b>{o.shipment.tracking_number}</b></p>}</section>
        <section className={`${card} p-6 text-xs space-y-1`}><h3 className="font-extrabold text-pine-900 text-sm mb-2">Paiement</h3>
          {pay0 ? <><p>{METHOD[pay0.method] || pay0.method}</p><p>Montant : <b>{money(pay0.amount)}</b></p>{pay0.operator && <p>Opérateur : {pay0.operator}{pay0.payer_phone ? ` · ${pay0.payer_phone}` : ''}</p>}{pay0.payer_reference && <p>Référence : <span className="font-mono">{pay0.payer_reference}</span></p>}{pay0.paid_at && <p>Payé le {dateFr(pay0.paid_at, true)}</p>}{Number(pay0.refunded_amount) > 0 && <p className="text-purple-700">Remboursé : {money(pay0.refunded_amount)}</p>}{pay0.failure_reason && <p className="text-red-600">{pay0.failure_reason}</p>}</> : <p>—</p>}</section>
      </div>
      <section className={`${card} p-6`}><h3 className="font-extrabold text-pine-900 mb-4">Suivi</h3><Timeline events={o.tracking?.length ? o.tracking : o.history} /></section>
    </>
  );
}
export const OrderDetail = ({ id }: { id: string }) => <Suspense fallback={<Spinner />}><DetailInner id={id} /></Suspense>;
