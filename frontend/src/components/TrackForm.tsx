'use client';
import { FormEvent, useState } from 'react';
import { api, dateFr } from '@/lib/api';
import { SHIPMENT_STATUS, ORDER_STATUS } from '@/lib/labels';
import { Alert, Field, btnPrimary, card, inputCls } from './ui';
import Timeline from './Timeline';

export default function TrackForm() {
  const [f, setF] = useState({ order: '', email: '' }); const [res, setRes] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setRes(null);
    try { setRes(await api.get(`/orders/track?order=${encodeURIComponent(f.order.trim())}&email=${encodeURIComponent(f.email.trim())}`)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-8 max-w-4xl">
      <form onSubmit={submit} className={`${card} p-6 space-y-4 h-fit`}>
        {err && <Alert>{err}</Alert>}
        <Field label="Numéro de commande"><input required value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} placeholder="VIV-20261104-ABC123" className={inputCls} /></Field>
        <Field label="Email de la commande"><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Recherche…' : 'Suivre ma commande'}</button>
      </form>
      {res && (
        <div className={`${card} p-6 space-y-4`}>
          <div><p className="text-xs text-gray-500">Commande</p><p className="font-extrabold text-pine-900">{res.orderNumber}</p></div>
          <p className="text-sm">Statut : <b>{ORDER_STATUS[res.status]?.label || res.status}</b></p>
          {res.shipment && <p className="text-xs text-gray-600">N° de suivi : <b>{res.shipment.trackingNumber}</b> · {SHIPMENT_STATUS[res.shipment.status]}{res.shipment.estimatedDelivery ? ` · Livraison estimée le ${dateFr(res.shipment.estimatedDelivery)}` : ''}</p>}
          <Timeline events={res.events} />
        </div>
      )}
    </div>
  );
}
