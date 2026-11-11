'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateFr, money, qs } from '@/lib/api';
import { METHOD, ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS, SHIPMENT_STATUS } from '@/lib/labels';
import Timeline from '../Timeline';
import { Col, FormModal, ListView, Loading, Modal, Msg, PageTitle, Pill, aBtn, aBtn2, aCard, aDanger, aInput, clean, toLocalInput, useApi, useCan, useToast } from './kit';

const orderOpts = Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label] as [string, string]);
const payOpts = Object.entries(PAYMENT_STATUS).map(([k, v]) => [k, v.label] as [string, string]);
const pdf = (path: string) => window.open(`/api${path}`, '_blank');

/* ----------------------------------------------------------- Commandes */
export function Orders() {
  const can = useCan();
  const cols: Col[] = [
    { key: 'order_number', label: 'N°', render: (r) => <Link className="font-bold text-pine-900 underline" href={`/admin/commandes/${r.id}`}>{r.order_number}</Link> },
    { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at, true) },
    { key: 'customer_name', label: 'Client', render: (r) => <>{r.customer_name}<br /><span className="text-gray-400">{r.customer_email}</span></> },
    { key: 'status', label: 'Statut', render: (r) => <Pill map={ORDER_STATUS} v={r.status} /> },
    { key: 'payment_status', label: 'Paiement', render: (r) => <><Pill map={PAYMENT_STATUS} v={r.payment_status} /><br /><span className="text-gray-400">{METHOD[r.payment_method] || ''}</span></> },
    { key: 'grand_total', label: 'Total', render: (r) => <b>{money(r.grand_total)}</b> },
  ];
  return (
    <>
      <PageTitle title="Commandes" sub="Suivi et traitement des commandes">{can('reports.view') && <button className={aBtn2} onClick={() => pdf(`/admin/reports/orders${qs({ format: 'xlsx', from: '2000-01-01' })}`)}><i className="fa-solid fa-file-excel mr-1"></i>Exporter Excel</button>}</PageTitle>
      <ListView path="/admin/orders" listKey="orders" cols={cols} filters={[{ key: 'q', label: 'N° commande, client, email' }, { key: 'status', label: 'Statut', type: 'select', options: orderOpts }, { key: 'paymentStatus', label: 'Paiement', type: 'select', options: payOpts }, { key: 'from', label: 'Du', type: 'date' }, { key: 'to', label: 'Au', type: 'date' }]} />
    </>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const toast = useToast(); const can = useCan();
  const { data, loading, error, reload } = useApi<any>(`/admin/orders/${id}`);
  const [status, setStatus] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [refund, setRefund] = useState<any>(null);
  if (loading && !data) return <Loading />; if (error) return <Msg>{error}</Msg>; const o = data?.order; if (!o) return null;
  const a = o.shipping_address || {};
  const change = async (s: string) => { setErr(''); try { await api.patch(`/admin/orders/${id}/status`, { status: s, note: note || null }); setNote(''); setStatus(''); toast('Statut mis à jour'); reload(); } catch (e: any) { setErr(e.message); } };
  const confirmPay = async (pid: number) => { setErr(''); try { await api.post(`/admin/payments/${pid}/confirm`, {}); toast('Paiement confirmé'); reload(); } catch (e: any) { setErr(e.message); } };
  const rejectPay = async (pid: number, reason: string) => { setErr(''); try { await api.post(`/admin/payments/${pid}/reject`, { reason }); toast('Paiement rejeté, le client est notifié'); reload(); } catch (e: any) { setErr(e.message); } };
  const next: string[] = [...o.allowedNext, ...(o.canCancel ? ['cancelled'] : [])];
  return (
    <>
      <Link href="/admin/commandes" className="text-xs font-bold text-accent-600"><i className="fa-solid fa-arrow-left mr-1"></i>Commandes</Link>
      <PageTitle title={o.order_number} sub={`Passée le ${dateFr(o.created_at, true)}`}>
        <Pill map={ORDER_STATUS} v={o.status} /><Pill map={PAYMENT_STATUS} v={o.payment_status} />
        <button className={aBtn2} onClick={() => pdf(`/admin/orders/${id}/invoice.pdf`)}>Facture</button><button className={aBtn2} onClick={() => pdf(`/admin/orders/${id}/slip.pdf`)}>Bon de livraison</button>
        {o.payment_status !== 'unpaid' && <button className={aBtn2} onClick={() => pdf(`/admin/orders/${id}/receipt.pdf`)}>Reçu</button>}
      </PageTitle>
      {err && <Msg>{err}</Msg>}
      {can('orders.manage') && next.length > 0 && (
        <section className={`${aCard} p-5 space-y-3`}><h2 className="text-sm font-extrabold text-pine-900">Changer le statut</h2>
          <div className="flex flex-wrap gap-2 items-center"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" className={`${aInput} !w-64`} />
            {next.map((s) => <button key={s} className={s === 'cancelled' ? aDanger : aBtn} onClick={() => (s !== 'cancelled' || confirm('Annuler cette commande ? Le stock sera remis en vente.')) && change(s)}>{ORDER_STATUS[s]?.label || s}</button>)}</div></section>)}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className={`${aCard} p-5 lg:col-span-2`}><h2 className="text-sm font-extrabold text-pine-900 mb-3">Articles</h2>
          <table className="w-full text-xs"><tbody className="divide-y">{o.items.map((i: any) => <tr key={i.id}><td className="py-2">{i.name}{i.variant_name && <span className="text-gray-500"> · {i.variant_name}</span>}<br /><span className="text-gray-400">{i.sku}</span></td><td className="text-right">{money(i.unit_price)} × {i.quantity}</td><td className="text-right font-bold">{money(i.line_total)}</td></tr>)}</tbody></table>
          <dl className="text-xs space-y-1 mt-3 border-t pt-3 max-w-[260px] ml-auto"><div className="flex justify-between"><dt>Sous-total</dt><dd>{money(o.subtotal)}</dd></div>{Number(o.discount_total) > 0 && <div className="flex justify-between"><dt>Remise {o.coupon_code && `(${o.coupon_code})`}</dt><dd>- {money(o.discount_total)}</dd></div>}<div className="flex justify-between"><dt>Livraison</dt><dd>{money(o.shipping_total)}</dd></div>{Number(o.tax_total) > 0 && <div className="flex justify-between"><dt>Taxes</dt><dd>{money(o.tax_total)}</dd></div>}<div className="flex justify-between font-extrabold text-sm"><dt>Total</dt><dd>{money(o.grand_total)}</dd></div></dl></section>
        <section className={`${aCard} p-5 text-xs space-y-1`}><h2 className="text-sm font-extrabold text-pine-900 mb-2">Client & livraison</h2>
          <p className="font-bold">{o.customer?.first_name} {o.customer?.last_name}</p><p>{o.customer_email}</p>{o.customer_phone && <p>{o.customer_phone}</p>}
          <p className="pt-2 font-bold">{a.full_name}</p><p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p><p>{a.postal_code} {a.city}, {a.country}</p>{o.notes && <p className="pt-2 italic text-gray-600">« {o.notes} »</p>}
          {o.shipment && <p className="pt-2">Suivi : <b>{o.shipment.tracking_number}</b>{o.shipment.courier_first_name && <><br />Livreur : {o.shipment.courier_first_name} {o.shipment.courier_last_name}</>}</p>}</section>
      </div>
      <section className={`${aCard} p-5 space-y-3`}><h2 className="text-sm font-extrabold text-pine-900">Paiements</h2>
        {o.payments.map((p: any) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 text-xs border-b last:border-0 pb-3 last:pb-0"><b>{METHOD[p.method]}</b><Pill map={PAYMENT_STATUS} v={p.status} /><span>{money(p.amount)}</span>{Number(p.refunded_amount) > 0 && <span className="text-purple-700">remboursé {money(p.refunded_amount)}</span>}{p.paid_at && <span className="text-gray-400">{dateFr(p.paid_at, true)}</span>}
            {(p.operator || p.payer_phone || p.payer_reference) && <span className="basis-full text-[11px] text-gray-600 bg-amber-50 rounded-lg px-3 py-2">{p.operator && <>Opérateur : <b>{p.operator}</b> · </>}{p.payer_phone && <>Tél. : <b>{p.payer_phone}</b> · </>}{p.payer_reference && <>Référence : <b className="font-mono">{p.payer_reference}</b></>}{p.proof_submitted_at && <> · preuve reçue le {dateFr(p.proof_submitted_at, true)}</>}</span>}
            <span className="flex-1" />
            {can('payments.manage') && p.status === 'pending' && p.proof_submitted_at && <button className={aDanger} onClick={() => { const r = window.prompt('Motif du rejet (visible par le client) :'); if (r && r.trim()) rejectPay(p.id, r.trim()); }}>Rejeter</button>}
            {can('payments.manage') && ['pending', 'failed'].includes(p.status) && !(p.method === 'card' && p.provider !== 'sandbox') && <button className={aBtn} onClick={() => confirm('Confirmer la réception de ce paiement ?') && confirmPay(p.id)}>Confirmer le paiement</button>}
            {can('payments.manage') && o.refundable.find((x: any) => x.paymentId === p.id)?.refundable > 0 && <button className={aDanger} onClick={() => setRefund({ paymentId: p.id, amount: o.refundable.find((x: any) => x.paymentId === p.id).refundable })}>Rembourser</button>}</div>))}</section>
      <section className={`${aCard} p-5`}><h2 className="text-sm font-extrabold text-pine-900 mb-4">Historique</h2><Timeline events={o.history} /></section>
      {refund && <FormModal title="Remboursement" initial={refund} fields={[{ name: 'amount', label: 'Montant à rembourser', type: 'number', step: '0.01', required: true }, { name: 'reason', label: 'Motif', type: 'text' }]} submitLabel="Rembourser" onClose={() => setRefund(null)}
        onSubmit={async (v) => { await api.post('/admin/refunds', { paymentId: refund.paymentId, amount: Number(v.amount), reason: v.reason || null }); toast('Remboursement effectué'); reload(); }} />}
    </>
  );
}

/* ----------------------------------------------------------- Paiements */
export function Payments() {
  const [tx, setTx] = useState<any[] | null>(null); const [tab, setTab] = useState<'p' | 'r' | 'c'>('p');
  const toast = useToast(); const can = useCan();
  const cols = (reload: () => void): Col[] => [
    { key: 'order_number', label: 'Commande', render: (r) => <Link className="font-bold text-pine-900 underline" href={`/admin/commandes/${r.order_id}`}>{r.order_number}</Link> },
    { key: 'method', label: 'Moyen', render: (r) => <>{METHOD[r.method] || r.method}{r.operator && <><br /><span className="text-gray-400">{r.operator}</span></>}</> },
    { key: 'status', label: 'Statut', render: (r) => <><Pill map={PAYMENT_STATUS} v={r.status} />{r.status === 'pending' && r.proof_submitted_at && <><br /><span className="text-[10px] font-extrabold text-amber-700">À VÉRIFIER</span></>}</> },
    { key: 'amount', label: 'Montant', render: (r) => <b>{money(r.amount)}</b> },
    { key: 'payer_reference', label: 'Référence client', render: (r) => (r.payer_reference || r.payer_phone) ? <span className="text-[11px]">{r.payer_phone && <>{r.payer_phone}<br /></>}<span className="font-mono">{r.payer_reference}</span></span> : '—' },
    { key: 'refunded_amount', label: 'Remboursé', render: (r) => Number(r.refunded_amount) ? money(r.refunded_amount) : '—' },
    { key: 'paid_at', label: 'Payé le', render: (r) => (r.paid_at ? dateFr(r.paid_at, true) : '—') },
    { key: 'j', label: '', render: (r) => <div className="flex flex-wrap gap-1">
      {can('payments.manage') && r.status === 'pending' && r.proof_submitted_at && <>
        <button className={aBtn} onClick={async () => { if (!confirm(`Confirmer la réception de ${money(r.amount)} pour ${r.order_number} ?`)) return; try { await api.post(`/admin/payments/${r.id}/confirm`, {}); toast('Paiement confirmé'); reload(); } catch (e: any) { toast(e.message); } }}>Confirmer</button>
        <button className={aDanger} onClick={async () => { const reason = window.prompt('Motif du rejet (visible par le client) :'); if (!reason || !reason.trim()) return; try { await api.post(`/admin/payments/${r.id}/reject`, { reason: reason.trim() }); toast('Paiement rejeté, le client est notifié'); reload(); } catch (e: any) { toast(e.message); } }}>Rejeter</button></>}
      <button className={aBtn2} onClick={async () => setTx((await api.get(`/admin/payments/${r.id}/transactions`)).transactions)}>Journal</button></div> },
  ];
  const rcols: Col[] = [{ key: 'order_number', label: 'Commande' }, { key: 'amount', label: 'Montant', render: (r) => money(r.amount) }, { key: 'reason', label: 'Motif' }, { key: 'status', label: 'Statut' }, { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at, true) }];
  return (
    <>
      <PageTitle title="Paiements" sub="Transactions, vérifications, remboursements et moyens de paiement" />
      <div className="flex flex-wrap gap-2">{([['p', 'Paiements'], ['r', 'Remboursements'], ['c', 'Moyens de paiement']] as const).filter(([k]) => k !== 'c' || can('payments.manage', 'settings.manage')).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? aBtn : aBtn2}>{l}</button>)}</div>
      {tab === 'p' && <ListView path="/admin/payments" listKey="payments" cols={cols} filters={[{ key: 'q', label: 'Commande, référence, reçu' }, { key: 'proof', label: 'Vérification', type: 'select', options: [['1', 'À vérifier (preuve reçue)']] }, { key: 'status', label: 'Statut', type: 'select', options: payOpts }, { key: 'method', label: 'Moyen', type: 'select', options: Object.entries(METHOD) }]} />}
      {tab === 'r' && <ListView path="/admin/refunds" listKey="refunds" cols={rcols} />}
      {tab === 'c' && <PaymentConfig />}
      {tx && <Modal title="Journal des transactions" onClose={() => setTx(null)} wide><Table2 rows={tx} /></Modal>}
    </>
  );
}

/* ----------------------------------------------------------- Configuration des moyens de paiement */
const cfgInput = aInput;
function PaymentConfig() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>('/admin/payment-config');
  const [cfg, setCfg] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (data?.config) setCfg(JSON.parse(JSON.stringify(data.config))); }, [data]);
  if (loading && !cfg) return <Loading />; if (error) return <Msg>{error}</Msg>; if (!cfg) return null;
  const set = (m: string, k: string, v: any) => setCfg((c: any) => ({ ...c, [m]: { ...c[m], [k]: v } }));
  const setOp = (i: number, k: string, v: any) => setCfg((c: any) => { const ops = [...c.mobile_money.operators]; ops[i] = { ...ops[i], [k]: v }; return { ...c, mobile_money: { ...c.mobile_money, operators: ops } }; });
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.put('/admin/payment-config', cfg); toast('Moyens de paiement enregistrés'); reload(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const mode = data?.mode;
  const Head = ({ m, title, icon }: { m: string; title: string; icon: string }) => (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-extrabold text-pine-900"><i className={`fa-solid ${icon} mr-2`}></i>{title}</h3>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!!cfg[m].enabled} onChange={(e) => set(m, 'enabled', e.target.checked)} /> Activé</label>
    </div>
  );
  const Texts = ({ m }: { m: string }) => (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs font-bold text-gray-700">Libellé affiché au client<input className={cfgInput} value={cfg[m].label || ''} onChange={(e) => set(m, 'label', e.target.value)} /></label>
      <label className="text-xs font-bold text-gray-700">Description<input className={cfgInput} value={cfg[m].description || ''} onChange={(e) => set(m, 'description', e.target.value)} /></label>
    </div>
  );
  return (
    <div className="space-y-4 max-w-4xl">
      <Msg kind="info">Mode de traitement : <b>{mode === 'sandbox' ? 'TEST (sandbox) — les paiements par carte et Mobile Money sont simulés' : 'PRODUCTION'}</b>{data?.stripe ? ' · Stripe configuré' : ' · Stripe non configuré'}. Un moyen de paiement n'est proposé aux clients que s'il est activé et correctement renseigné.</Msg>
      {err && <Msg>{err}</Msg>}
      <section className={`${aCard} p-5 space-y-3`}><Head m="cod" title="Paiement à la livraison" icon="fa-money-bill-wave" /><Texts m="cod" /></section>
      <section className={`${aCard} p-5 space-y-3`}><Head m="card" title="Carte bancaire" icon="fa-credit-card" /><Texts m="card" />
        <p className="text-[11px] text-gray-500">{mode === 'sandbox' ? 'Mode test : formulaire de carte simulé.' : data?.stripe ? 'Paiement via la page sécurisée Stripe.' : 'Clés Stripe manquantes dans le fichier .env : la carte ne sera pas proposée.'}</p></section>
      <section className={`${aCard} p-5 space-y-3`}><Head m="mobile_money" title="Mobile Money" icon="fa-mobile-screen" /><Texts m="mobile_money" />
        <div className="space-y-3">
          {cfg.mobile_money.operators.map((o: any, i: number) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="text-[11px] font-bold text-gray-700">Nom<input className={cfgInput} value={o.name} onChange={(e) => setOp(i, 'name', e.target.value)} /></label>
                <label className="text-[11px] font-bold text-gray-700">Code<input className={cfgInput} value={o.code} onChange={(e) => setOp(i, 'code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></label>
                <label className="text-[11px] font-bold text-gray-700">Numéro marchand<input className={cfgInput} value={o.number} onChange={(e) => setOp(i, 'number', e.target.value)} placeholder="+257 …" /></label>
                <label className="text-[11px] font-bold text-gray-700 sm:col-span-3">Nom du compte<input className={cfgInput} value={o.account_name} onChange={(e) => setOp(i, 'account_name', e.target.value)} /></label>
                <label className="text-[11px] font-bold text-gray-700 sm:col-span-3">Instructions pour le client<textarea rows={2} className={cfgInput} value={o.instructions} onChange={(e) => setOp(i, 'instructions', e.target.value)} placeholder="Ex. : composez *XXX#, choisissez « Payer un marchand »…" /></label>
              </div>
              <button type="button" className={aDanger} onClick={() => setCfg((c: any) => ({ ...c, mobile_money: { ...c.mobile_money, operators: c.mobile_money.operators.filter((_: any, j: number) => j !== i) } }))}>Retirer cet opérateur</button>
            </div>))}
          <button type="button" className={aBtn2} onClick={() => setCfg((c: any) => ({ ...c, mobile_money: { ...c.mobile_money, operators: [...c.mobile_money.operators, { code: '', name: '', number: '', account_name: '', instructions: '' }] } }))}><i className="fa-solid fa-plus mr-1"></i>Ajouter un opérateur</button>
        </div>
        {mode !== 'sandbox' && <p className="text-[11px] text-gray-500">Un opérateur sans numéro marchand n'est pas proposé. Les clients envoient la preuve de transaction, que vous confirmez ou rejetez dans l'onglet « Paiements ».</p>}</section>
      <section className={`${aCard} p-5 space-y-3`}><Head m="bank_transfer" title="Virement bancaire" icon="fa-building-columns" /><Texts m="bank_transfer" />
        <label className="text-xs font-bold text-gray-700 block">Coordonnées bancaires (IBAN, BIC, titulaire…)<textarea rows={4} className={cfgInput} value={cfg.bank_transfer.details || ''} onChange={(e) => set('bank_transfer', 'details', e.target.value)} /></label></section>
      <button disabled={busy} onClick={save} className={aBtn}>{busy ? '…' : 'Enregistrer les moyens de paiement'}</button>
    </div>
  );
}
function Table2({ rows }: { rows: any[] }) {
  return rows.length === 0 ? <p className="text-xs text-gray-400">Aucune transaction.</p> : <div className="space-y-2">{rows.map((t) => <div key={t.id} className="text-xs bg-gray-50 rounded-xl p-3"><b>{t.type}</b> · {t.status} · {dateFr(t.created_at, true)}{Number(t.amount) > 0 && <> · {money(t.amount)}</>}{t.provider_ref && <span className="text-gray-400"> · {t.provider_ref}</span>}{t.note && <p className="text-gray-500 mt-1">{t.note}</p>}</div>)}</div>;
}

/* ----------------------------------------------------------- Livraisons */
export function Shipments() {
  const toast = useToast(); const can = useCan(); const couriers = useApi<any>(can('shipments.manage') ? '/admin/couriers' : null);
  const [upd, setUpd] = useState<any>(null); const [zones, setZones] = useState(false);
  const cols = (reload: () => void): Col[] => [
    { key: 'tracking_number', label: 'Suivi', render: (r) => <><b>{r.tracking_number}</b><br /><Link href={`/admin/commandes/${r.order_id}`} className="text-gray-400 underline">{r.order_number}</Link></> },
    { key: 'dest', label: 'Destinataire', render: (r) => <>{r.shipping_address?.full_name}<br /><span className="text-gray-400">{r.shipping_address?.line1}, {r.shipping_address?.city}</span>{r.customer_phone && <><br /><span className="text-gray-400">{r.customer_phone}</span></>}</> },
    { key: 'status', label: 'Statut', render: (r) => <span className="font-bold">{SHIPMENT_STATUS[r.status] || r.status}</span> },
    { key: 'cod', label: 'À encaisser', render: (r) => (r.payment_method === 'cod' && r.payment_status !== 'paid' ? <b className="text-accent-600">{money(r.grand_total)}</b> : '—') },
    { key: 'courier', label: 'Livreur', render: (r) => can('shipments.manage') ? (
      <select aria-label="Livreur" value={r.courier_id || ''} onChange={async (e) => { try { await api.patch(`/admin/shipments/${r.id}/courier`, { courier_id: e.target.value ? Number(e.target.value) : null }); toast('Livreur assigné'); reload(); } catch (x: any) { toast(x.message); } }} className={`${aInput} !w-40`}><option value="">Non assigné</option>{(couriers.data?.couriers || []).map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select>) : (r.courier_name || '—') },
    { key: 'a', label: '', render: (r) => <button className={aBtn} onClick={() => setUpd({ ...r, newStatus: '' })}>Mettre à jour</button> },
  ];
  const nextOpts: [string, string][] = Object.entries(SHIPMENT_STATUS).filter(([k]) => !['pending', 'cancelled'].includes(k)).map(([k, v]) => [k === 'failed' ? 'failed' : k, v]);
  return (
    <>
      <PageTitle title="Livraisons" sub="Expéditions, livreurs et suivi">{can('shipments.manage') && <button className={aBtn2} onClick={() => setZones(true)}>Zones & tarifs de livraison</button>}</PageTitle>
      <ListView path="/admin/shipments" listKey="shipments" cols={cols} filters={[{ key: 'q', label: 'N° commande ou suivi' }, { key: 'status', label: 'Statut', type: 'select', options: Object.entries(SHIPMENT_STATUS) }]}
        extra={(reload) => upd && <FormModal title={`Colis ${upd.tracking_number}`} initial={{ status: '', note: '', location: '', failure_reason: '' }} onClose={() => setUpd(null)} submitLabel="Valider"
          fields={[{ name: 'status', label: 'Nouveau statut', type: 'select', options: nextOpts, required: true }, { name: 'location', label: 'Lieu', half: true }, { name: 'note', label: 'Note', half: true }, { name: 'failure_reason', label: "Motif de l'échec (si échec)" }]}
          onSubmit={async (v) => { await api.patch(`/admin/shipments/${upd.id}/status`, clean(v)); toast('Livraison mise à jour'); reload(); }} />} />
      {zones && <ZonesModal onClose={() => setZones(false)} />}
    </>
  );
}
function ZonesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const { data, reload } = useApi<any>('/admin/shipping/zones'); const [zone, setZone] = useState<any>(null); const [method, setMethod] = useState<any>(null);
  return (
    <Modal title="Zones et modes de livraison" onClose={onClose} wide>
      <div className="space-y-4">
        <button className={aBtn} onClick={() => setZone({ is_active: 1 })}>+ Nouvelle zone</button>
        {!data ? <Loading /> : data.zones.map((z: any) => (
          <div key={z.id} className="border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs"><b className="text-sm">{z.name}</b><span className="text-gray-400">{z.countries}</span>{!z.is_active && <span className="text-amber-700 font-bold">inactive</span>}<span className="flex-1" />
              <button className={aBtn2} onClick={() => setZone(z)}>Modifier</button><button className={aDanger} onClick={async () => { if (confirm('Supprimer la zone et ses modes ?')) { try { await api.del(`/admin/shipping/zones/${z.id}`); reload(); } catch (e: any) { toast(e.message); } } }}>Supprimer</button></div>
            {z.methods.map((m: any) => <div key={m.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2"><b>{m.name}</b><span>{money(m.fee)}</span>{m.free_over != null && <span className="text-gray-500">gratuit dès {money(m.free_over)}</span>}<span className="text-gray-400">{m.min_days}-{m.max_days} j</span><span className="flex-1" />
              <button className={aBtn2} onClick={() => setMethod(m)}>Modifier</button><button className={aDanger} onClick={async () => { if (confirm('Supprimer ce mode ?')) { try { await api.del(`/admin/shipping/methods/${m.id}`); reload(); } catch (e: any) { toast(e.message); } } }}>×</button></div>)}
            <button className={aBtn2} onClick={() => setMethod({ zone_id: z.id, is_active: 1, min_days: 2, max_days: 5 })}>+ Mode de livraison</button></div>))}
      </div>
      {zone && <FormModal title="Zone" initial={zone} onClose={() => setZone(null)} fields={[{ name: 'name', label: 'Nom', required: true }, { name: 'countries', label: 'Pays (codes ISO séparés par des virgules, * = tous)', required: true, hint: 'Ex. FR,BE,DE' }, { name: 'is_active', label: 'Active', type: 'checkbox' }]}
        onSubmit={async (v) => { const b = { name: v.name, countries: v.countries, is_active: v.is_active ? 1 : 0 }; zone.id ? await api.put(`/admin/shipping/zones/${zone.id}`, b) : await api.post('/admin/shipping/zones', b); reload(); }} />}
      {method && <FormModal title="Mode de livraison" initial={method} onClose={() => setMethod(null)} fields={[{ name: 'name', label: 'Nom', required: true, half: true }, { name: 'code', label: 'Code', required: true, half: true }, { name: 'fee', label: 'Tarif', type: 'number', step: '0.01', required: true, half: true }, { name: 'free_over', label: 'Gratuit au-delà de', type: 'number', step: '0.01', half: true }, { name: 'min_days', label: 'Délai min (jours)', type: 'number', half: true }, { name: 'max_days', label: 'Délai max (jours)', type: 'number', half: true }, { name: 'is_active', label: 'Actif', type: 'checkbox' }]}
        onSubmit={async (v) => { const b = { zone_id: Number(method.zone_id), code: v.code, name: v.name, fee: Number(v.fee), free_over: v.free_over === '' || v.free_over == null ? null : Number(v.free_over), min_days: Number(v.min_days), max_days: Number(v.max_days), is_active: v.is_active ? 1 : 0 }; method.id ? await api.put(`/admin/shipping/methods/${method.id}`, b) : await api.post('/admin/shipping/methods', b); reload(); }} />}
    </Modal>
  );
}

/* ----------------------------------------------------------- Retours */
export function Returns() {
  const toast = useToast(); const [dec, setDec] = useState<any>(null);
  const FLOW: Record<string, string[]> = { requested: ['approved', 'rejected'], approved: ['received', 'rejected'], received: ['refunded', 'closed'], refunded: ['closed'], rejected: [], closed: [] };
  const cols = (reload: () => void): Col[] => [
    { key: 'order_number', label: 'Commande' }, { key: 'customer_name', label: 'Client' }, { key: 'product_name', label: 'Article', render: (r) => `${r.product_name} × ${r.quantity}` },
    { key: 'reason', label: 'Motif', render: (r) => <span className="line-clamp-2 max-w-xs">{r.reason}{r.details ? ` — ${r.details}` : ''}</span> },
    { key: 'status', label: 'Statut', render: (r) => <Pill map={RETURN_STATUS} v={r.status} /> }, { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at) },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end">{FLOW[r.status].map((s) => <button key={s} className={s === 'rejected' ? aDanger : aBtn} onClick={() => setDec({ ...r, newStatus: s })}>{RETURN_STATUS[s].label}</button>)}</div> },
  ];
  return (
    <>
      <PageTitle title="Retours & remboursements" sub="Demandes de retour des clients" />
      <ListView path="/admin/returns" listKey="returns" cols={cols} filters={[{ key: 'status', label: 'Statut', type: 'select', options: Object.entries(RETURN_STATUS).map(([k, v]) => [k, v.label]) }]}
        extra={(reload) => dec && <FormModal title={`Retour — ${RETURN_STATUS[dec.newStatus].label}`} onClose={() => setDec(null)}
          initial={{ admin_note: '', restock: 1, refund_amount: (Number(dec.unit_price) * dec.quantity).toFixed(2) }}
          fields={[{ name: 'admin_note', label: 'Message au client', type: 'textarea' }, ...(dec.newStatus === 'received' ? [{ name: 'restock', label: 'Remettre les articles en stock', type: 'checkbox' as const }] : []), ...(dec.newStatus === 'refunded' ? [{ name: 'refund_amount', label: 'Montant remboursé', type: 'number' as const, step: '0.01' }] : [])]}
          onSubmit={async (v) => { await api.patch(`/admin/returns/${dec.id}`, { status: dec.newStatus, admin_note: v.admin_note || null, restock: v.restock ? 1 : 0, ...(dec.newStatus === 'refunded' ? { refund_amount: Number(v.refund_amount) } : {}) }); toast('Retour mis à jour'); reload(); }} />} />
    </>
  );
}

/* ----------------------------------------------------------- Promotions */
export function Coupons() {
  const toast = useToast(); const [edit, setEdit] = useState<any>(undefined); const [k, setK] = useState(0);
  const cats = useApi<any>('/admin/categories'); const prods = useApi<any>(edit ? '/admin/products?limit=100' : null);
  const cols = (reload: () => void): Col[] => [
    { key: 'code', label: 'Code', render: (r) => <b className="font-mono">{r.code}</b> }, { key: 'description', label: 'Description' },
    { key: 'value', label: 'Remise', render: (r) => (r.type === 'percent' ? `${Number(r.value)} %` : money(r.value)) }, { key: 'min_order', label: 'Min.', render: (r) => (Number(r.min_order) ? money(r.min_order) : '—') },
    { key: 'used', label: 'Utilisations', render: (r) => `${r.used_count ?? 0}${r.usage_limit ? ` / ${r.usage_limit}` : ''}` },
    { key: 'ends_at', label: 'Validité', render: (r) => (r.ends_at ? `jusqu'au ${dateFr(r.ends_at)}` : 'illimitée') },
    { key: 'is_active', label: 'État', render: (r) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{r.is_active ? 'Actif' : 'Inactif'}</span> },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={() => setEdit({ ...r, starts_at: toLocalInput(r.starts_at), ends_at: toLocalInput(r.ends_at) })}>Modifier</button>
      <button className={aDanger} onClick={async () => { if (!confirm('Supprimer ce code ?')) return; const x = await api.del(`/admin/coupons/${r.id}`); toast(x.message || 'Supprimé'); reload(); }}>Supprimer</button></div> },
  ];
  const targetsFor = (a: string) => (a === 'categories' ? (cats.data?.categories || []).map((c: any) => [c.id, c.name]) : (prods.data?.products || []).map((p: any) => [p.id, p.name]));
  return (
    <>
      <PageTitle title="Promotions" sub="Codes promo et réductions"><button className={aBtn} onClick={() => setEdit({ type: 'percent', applies_to: 'all', is_active: 1, min_order: 0, targets: [] })}>+ Nouveau code</button></PageTitle>
      <ListView key={k} path="/admin/coupons" listKey="coupons" cols={cols} />
      {edit && <FormModal title={edit.id ? 'Modifier le code' : 'Nouveau code promo'} initial={edit} onClose={() => setEdit(undefined)}
        fields={(cv) => [{ name: 'code', label: 'Code', required: true, half: true }, { name: 'description', label: 'Description', half: true },
          { name: 'type', label: 'Type', type: 'select', options: [['percent', 'Pourcentage'], ['fixed', 'Montant fixe']], required: true, half: true }, { name: 'value', label: 'Valeur', type: 'number', step: '0.01', required: true, half: true },
          { name: 'min_order', label: 'Commande minimale', type: 'number', step: '0.01', half: true }, { name: 'max_discount', label: 'Remise maximale', type: 'number', step: '0.01', half: true },
          { name: 'starts_at', label: 'Début', type: 'datetime-local', half: true }, { name: 'ends_at', label: 'Fin', type: 'datetime-local', half: true },
          { name: 'usage_limit', label: "Limite d'utilisations", type: 'number', half: true }, { name: 'per_user_limit', label: 'Limite par client', type: 'number', half: true },
          { name: 'applies_to', label: "S'applique à", type: 'select', options: [['all', 'Tout le catalogue'], ['categories', 'Catégories'], ['products', 'Produits']], required: true },
          ...(cv.applies_to !== 'all' ? [{ name: 'targets', label: 'Cibles', type: 'checks' as const, options: targetsFor(cv.applies_to) }] : []), { name: 'is_active', label: 'Actif', type: 'checkbox' }]}
        onSubmit={async (v) => {
          const b = { code: v.code, description: v.description || null, type: v.type, value: Number(v.value), min_order: Number(v.min_order || 0), max_discount: v.max_discount === '' || v.max_discount == null ? null : Number(v.max_discount),
            starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null, ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null, usage_limit: v.usage_limit ? Number(v.usage_limit) : null, per_user_limit: v.per_user_limit ? Number(v.per_user_limit) : null, applies_to: v.applies_to, targets: v.applies_to === 'all' ? [] : (v.targets || []).map(Number), is_active: v.is_active ? 1 : 0 };
          edit.id ? await api.put(`/admin/coupons/${edit.id}`, b) : await api.post('/admin/coupons', b); toast('Code enregistré'); setK((x) => x + 1);
        }} />}
    </>
  );
}
