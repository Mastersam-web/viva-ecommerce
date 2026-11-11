'use client';
import { useState } from 'react';
import { api, dateFr, money } from '@/lib/api';
import { Col, FormModal, ListView, Loading, Modal, Msg, PageTitle, aBtn, aBtn2, aCard, aDanger, aInput, useApi, useCan, useToast } from './kit';

const LEVEL: Record<string, [string, string]> = { out: ['Rupture', 'bg-red-100 text-red-700'], low: ['Faible', 'bg-amber-100 text-amber-800'], ok: ['OK', 'bg-emerald-100 text-emerald-800'] };
const MOVE: Record<string, string> = { in: 'Entrée', out: 'Sortie', sale: 'Vente', return: 'Retour client', adjustment: 'Ajustement', inventory: 'Inventaire', purchase: 'Réception fournisseur', cancel: 'Annulation', restock: 'Remise en stock' };

/* ----------------------------------------------------------- Stocks */
export function Stock() {
  const toast = useToast(); const can = useCan(); const [tab, setTab] = useState<'s' | 'm'>('s'); const [act, setAct] = useState<any>(null); const [k, setK] = useState(0);
  const sum = useApi<any>(`/admin/stock?limit=1&k=${k}`);
  const cols: Col[] = [
    { key: 'image', label: '', render: (r) => r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="w-9 h-9 rounded-lg object-cover" /> : null },
    { key: 'name', label: 'Produit', render: (r) => <><b>{r.name}</b>{r.variant_name && <span className="text-gray-500"> · {r.variant_name}</span>}<br /><span className="text-gray-400">{r.sku}</span></> },
    { key: 'quantity', label: 'Quantité', render: (r) => <b className="text-base">{r.quantity}</b> }, { key: 'low_stock_threshold', label: 'Seuil' },
    { key: 'level', label: 'État', render: (r) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${LEVEL[r.level][1]}`}>{LEVEL[r.level][0]}</span> },
    { key: 'a', label: '', render: (r) => can('stock.manage') && <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={() => setAct({ kind: 'in', r })}>Entrée</button><button className={aBtn2} onClick={() => setAct({ kind: 'out', r })}>Sortie</button><button className={aBtn2} onClick={() => setAct({ kind: 'count', r })}>Inventaire</button><button className={aBtn2} onClick={() => setAct({ kind: 'thr', r })}>Seuil</button></div> },
  ];
  const mcols: Col[] = [
    { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at, true) }, { key: 'product_name', label: 'Produit', render: (r) => `${r.product_name}${r.variant_name ? ` · ${r.variant_name}` : ''}` },
    { key: 'type', label: 'Type', render: (r) => MOVE[r.type] || r.type }, { key: 'quantity', label: 'Qté', render: (r) => <b className={Number(r.quantity) < 0 ? 'text-red-600' : 'text-emerald-700'}>{Number(r.quantity) > 0 ? '+' : ''}{r.quantity}</b> },
    { key: 'balance_after', label: 'Solde' }, { key: 'note', label: 'Note' }, { key: 'user_name', label: 'Par' },
  ];
  const s = sum.data?.summary;
  const fields = act && ({ in: [{ name: 'quantity', label: 'Quantité entrante', type: 'number', min: 1, required: true }, { name: 'note', label: 'Note' }], out: [{ name: 'quantity', label: 'Quantité sortante', type: 'number', min: 1, required: true }, { name: 'note', label: 'Motif (casse, perte…)' }], count: [{ name: 'counted', label: 'Quantité comptée', type: 'number', min: 0, required: true, hint: `Stock théorique : ${act.r.quantity}` }, { name: 'note', label: 'Note' }], thr: [{ name: 'threshold', label: "Seuil d'alerte", type: 'number', min: 0, required: true }] } as any)[act.kind];
  return (
    <>
      <PageTitle title="Stocks" sub="Niveaux, mouvements et inventaires" />
      {s && <div className="grid grid-cols-3 gap-4">{[['Références', s.total, ''], ['Stock faible', s.low, 'text-amber-700'], ['Ruptures', s.out, 'text-red-600']].map(([t, v, c]) => <div key={t as string} className={`${aCard} p-4`}><b className={`text-2xl ${c}`}>{v}</b><p className="text-[11px] text-gray-500">{t}</p></div>)}</div>}
      <div className="flex gap-2">{([['s', 'Niveaux de stock'], ['m', 'Mouvements']] as const).map(([t, l]) => <button key={t} onClick={() => setTab(t)} className={tab === t ? aBtn : aBtn2}>{l}</button>)}</div>
      {tab === 's' ? <ListView key={k} path="/admin/stock" listKey="items" cols={cols} filters={[{ key: 'q', label: 'Produit ou SKU' }, { key: 'level', label: 'État', type: 'select', options: [['out', 'Rupture'], ['low', 'Stock faible'], ['ok', 'OK']] }]} />
        : <ListView path="/admin/stock/movements" listKey="movements" cols={mcols} filters={[{ key: 'type', label: 'Type', type: 'select', options: Object.entries(MOVE) }]} />}
      {act && <FormModal title={`${{ in: 'Entrée de stock', out: 'Sortie de stock', count: 'Inventaire', thr: "Seuil d'alerte" }[act.kind as string]} — ${act.r.name}${act.r.variant_name ? ` (${act.r.variant_name})` : ''}`} fields={fields} initial={act.kind === 'thr' ? { threshold: act.r.low_stock_threshold } : {}} onClose={() => setAct(null)}
        onSubmit={async (v) => {
          const base = { productId: act.r.product_id, variantId: act.r.variant_id || 0, note: v.note || null };
          if (act.kind === 'thr') await api.patch(`/admin/stock/${act.r.id}/threshold`, { threshold: Number(v.threshold) });
          else if (act.kind === 'count') await api.post('/admin/stock/inventory', { ...base, counted: Number(v.counted) });
          else await api.post('/admin/stock/move', { ...base, type: act.kind, quantity: Number(v.quantity) });
          toast('Stock mis à jour'); setK((x) => x + 1);
        }} />}
    </>
  );
}

/* ----------------------------------------------------------- Fournisseurs */
function SupplierDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast(); const { data, reload } = useApi<any>(`/admin/suppliers/${id}`); const prods = useApi<any>('/admin/products?limit=100'); const [link, setLink] = useState({ productId: '', supplier_sku: '', cost_price: '' }); const [err, setErr] = useState('');
  const add = async () => { setErr(''); try { await api.post(`/admin/suppliers/${id}/products`, { productId: Number(link.productId), supplier_sku: link.supplier_sku || null, cost_price: link.cost_price ? Number(link.cost_price) : null }); setLink({ productId: '', supplier_sku: '', cost_price: '' }); reload(); } catch (e: any) { setErr(e.message); } };
  return (
    <Modal title={data?.supplier?.name || 'Fournisseur'} onClose={onClose} wide>
      {!data ? <Loading /> : <div className="space-y-5 text-xs">
        <p>{[data.supplier.contact_name, data.supplier.email, data.supplier.phone, data.supplier.address].filter(Boolean).join(' · ') || 'Aucune coordonnée'}</p>
        {err && <Msg>{err}</Msg>}
        <section className="space-y-2"><h3 className="font-extrabold text-sm text-pine-900">Produits fournis</h3>
          {data.products.map((p: any) => <div key={p.product_id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"><b className="flex-1">{p.name}</b><span>{p.supplier_sku}</span><span>{p.cost_price != null ? money(p.cost_price) : ''}</span><button className={aDanger} onClick={async () => { await api.del(`/admin/suppliers/${id}/products/${p.product_id}`); reload(); }}>×</button></div>)}
          <div className="flex flex-wrap gap-2"><select value={link.productId} onChange={(e) => setLink({ ...link, productId: e.target.value })} className={`${aInput} !w-60`} aria-label="Produit"><option value="">Produit…</option>{(prods.data?.products || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input placeholder="Réf. fournisseur" value={link.supplier_sku} onChange={(e) => setLink({ ...link, supplier_sku: e.target.value })} className={`${aInput} !w-40`} /><input placeholder="Coût" type="number" step="0.01" value={link.cost_price} onChange={(e) => setLink({ ...link, cost_price: e.target.value })} className={`${aInput} !w-28`} /><button disabled={!link.productId} className={aBtn} onClick={add}>Associer</button></div></section>
        <section className="space-y-2"><h3 className="font-extrabold text-sm text-pine-900">Historique des approvisionnements</h3>
          {data.purchaseOrders.length === 0 ? <p className="text-gray-400">Aucun.</p> : data.purchaseOrders.map((p: any) => <div key={p.id} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2"><b>{p.reference}</b><span>{PO_STATUS[p.status]}</span><span>{money(p.total)}</span><span>{dateFr(p.created_at)}</span></div>)}</section>
      </div>}
    </Modal>
  );
}
export function Suppliers() {
  const toast = useToast(); const [edit, setEdit] = useState<any>(undefined); const [view, setView] = useState<number | null>(null); const [k, setK] = useState(0);
  const cols = (reload: () => void): Col[] => [
    { key: 'name', label: 'Fournisseur', render: (r) => <><b>{r.name}</b>{!r.is_active && <span className="text-amber-700 font-bold"> · inactif</span>}<br /><span className="text-gray-400">{r.contact_name}</span></> }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Téléphone' },
    { key: 'product_count', label: 'Produits' }, { key: 'order_count', label: 'Commandes' },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={() => setView(r.id)}>Détail</button><button className={aBtn2} onClick={() => setEdit(r)}>Modifier</button>
      <button className={aDanger} onClick={async () => { if (!confirm('Supprimer ce fournisseur ?')) return; const x = await api.del(`/admin/suppliers/${r.id}`); toast(x.message || 'Supprimé'); reload(); }}>Supprimer</button></div> },
  ];
  return (
    <>
      <PageTitle title="Fournisseurs" sub="Partenaires d'approvisionnement"><button className={aBtn} onClick={() => setEdit({ is_active: 1 })}>+ Nouveau fournisseur</button></PageTitle>
      <ListView key={k} path="/admin/suppliers" listKey="suppliers" cols={cols} />
      {view && <SupplierDetail id={view} onClose={() => setView(null)} />}
      {edit && <FormModal title={edit.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} initial={edit} onClose={() => setEdit(undefined)}
        fields={[{ name: 'name', label: 'Nom', required: true }, { name: 'contact_name', label: 'Contact', half: true }, { name: 'email', label: 'Email', type: 'email', half: true }, { name: 'phone', label: 'Téléphone', half: true }, { name: 'address', label: 'Adresse', half: true }, { name: 'notes', label: 'Notes', type: 'textarea' }, { name: 'is_active', label: 'Actif', type: 'checkbox' }]}
        onSubmit={async (v) => { const b = { name: v.name, contact_name: v.contact_name || null, email: v.email || null, phone: v.phone || null, address: v.address || null, notes: v.notes || null, is_active: v.is_active ? 1 : 0 }; edit.id ? await api.put(`/admin/suppliers/${edit.id}`, b) : await api.post('/admin/suppliers', b); toast('Fournisseur enregistré'); setK((x) => x + 1); }} />}
    </>
  );
}

/* ----------------------------------------------------------- Approvisionnements */
const PO_STATUS: Record<string, string> = { draft: 'Brouillon', ordered: 'Commandée', partial: 'Partielle', received: 'Reçue', cancelled: 'Annulée' };
function POForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const sup = useApi<any>('/admin/suppliers'); const prods = useApi<any>('/admin/products?limit=100');
  const [v, setV] = useState<any>({ supplier_id: '', expected_at: '', notes: '', items: [{ productId: '', variantId: 0, quantity: 1, unit_cost: '' }] }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const setItem = (i: number, k: string, val: any) => setV({ ...v, items: v.items.map((x: any, n: number) => (n === i ? { ...x, [k]: val } : x)) });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post('/admin/purchase-orders', { supplier_id: Number(v.supplier_id), expected_at: v.expected_at || null, notes: v.notes || null, items: v.items.map((x: any) => ({ productId: Number(x.productId), variantId: Number(x.variantId || 0), quantity: Number(x.quantity), unit_cost: Number(x.unit_cost) })) }); toast('Commande fournisseur créée'); onSaved(); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <Modal title="Nouvelle commande fournisseur" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">{err && <Msg>{err}</Msg>}
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="text-xs font-bold">Fournisseur *</label><select required value={v.supplier_id} onChange={(e) => setV({ ...v, supplier_id: e.target.value })} className={aInput}><option value="">—</option>{(sup.data?.suppliers || []).filter((s: any) => s.is_active).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="text-xs font-bold">Livraison prévue</label><input type="date" value={v.expected_at} onChange={(e) => setV({ ...v, expected_at: e.target.value })} className={aInput} /></div>
        </div>
        <div className="space-y-2">{v.items.map((it: any, i: number) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
            <select required aria-label="Produit" value={it.productId} onChange={(e) => setItem(i, 'productId', e.target.value)} className={`${aInput} sm:col-span-2`}><option value="">Produit…</option>{(prods.data?.products || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input required aria-label="Quantité" type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} className={aInput} /><input required aria-label="Coût unitaire" placeholder="Coût unitaire" type="number" step="0.01" min={0} value={it.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} className={aInput} />
            <button type="button" disabled={v.items.length === 1} className={aDanger} onClick={() => setV({ ...v, items: v.items.filter((_: any, n: number) => n !== i) })}>Retirer</button></div>))}
          <button type="button" className={aBtn2} onClick={() => setV({ ...v, items: [...v.items, { productId: '', variantId: 0, quantity: 1, unit_cost: '' }] })}>+ Ligne</button>
          <p className="text-[11px] text-gray-400">Pour un produit avec variantes, la réception alimente le stock de base ; ajustez ensuite par variante depuis « Stocks ».</p></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={aBtn2}>Annuler</button><button disabled={busy} className={aBtn}>Créer</button></div>
      </form>
    </Modal>
  );
}
function PODetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast(); const can = useCan(); const { data, reload } = useApi<any>(`/admin/purchase-orders/${id}`); const [q, setQ] = useState<Record<number, string>>({}); const [err, setErr] = useState('');
  const receive = async () => { setErr(''); const items = Object.entries(q).filter(([, n]) => Number(n) > 0).map(([itemId, n]) => ({ itemId: Number(itemId), quantity: Number(n) })); if (!items.length) return setErr('Saisissez une quantité reçue'); try { await api.post(`/admin/purchase-orders/${id}/receive`, { items }); toast('Réception enregistrée, stock mis à jour'); setQ({}); reload(); onChanged(); } catch (e: any) { setErr(e.message); } };
  const po = data?.purchaseOrder; const open = po && !['received', 'cancelled'].includes(po.status);
  return (
    <Modal title={po ? `${po.reference} — ${po.supplier_name}` : 'Commande'} onClose={onClose} wide>
      {!data ? <Loading /> : <div className="space-y-4 text-xs">{err && <Msg>{err}</Msg>}
        <p>Statut : <b>{PO_STATUS[po.status]}</b>{po.expected_at && <> · Prévue le {dateFr(po.expected_at)}</>}{po.notes && <> · {po.notes}</>}</p>
        <table className="w-full"><thead><tr className="text-left text-gray-500"><th className="py-1">Produit</th><th>Commandé</th><th>Reçu</th><th>Coût</th>{open && can('stock.manage') && <th>Réceptionner</th>}</tr></thead><tbody className="divide-y">{data.items.map((i: any) => <tr key={i.id}><td className="py-2"><b>{i.name}</b>{i.variant_name && ` · ${i.variant_name}`}</td><td>{i.quantity}</td><td>{i.received_quantity}</td><td>{money(i.unit_cost)}</td>
          {open && can('stock.manage') && <td>{i.quantity - i.received_quantity > 0 ? <input type="number" min={0} max={i.quantity - i.received_quantity} value={q[i.id] || ''} onChange={(e) => setQ({ ...q, [i.id]: e.target.value })} className={`${aInput} !w-24`} aria-label="Quantité reçue" /> : '✓'}</td>}</tr>)}</tbody></table>
        {open && <div className="flex gap-2 justify-end">{can('stock.manage') && <button className={aBtn} onClick={receive}>Enregistrer la réception</button>}<button className={aDanger} onClick={async () => { if (confirm('Annuler cette commande fournisseur ?')) { await api.post(`/admin/purchase-orders/${id}/cancel`, {}); reload(); onChanged(); } }}>Annuler la commande</button></div>}
      </div>}
    </Modal>
  );
}
export function PurchaseOrders() {
  const [form, setForm] = useState(false); const [view, setView] = useState<number | null>(null); const [k, setK] = useState(0);
  const cols: Col[] = [
    { key: 'reference', label: 'Référence', render: (r) => <b>{r.reference}</b> }, { key: 'supplier_name', label: 'Fournisseur' }, { key: 'status', label: 'Statut', render: (r) => PO_STATUS[r.status] },
    { key: 'qty', label: 'Reçu / Commandé', render: (r) => `${r.received} / ${r.qty}` }, { key: 'total', label: 'Total', render: (r) => money(r.total) }, { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at) },
    { key: 'a', label: '', render: (r) => <button className={aBtn2} onClick={() => setView(r.id)}>Ouvrir</button> },
  ];
  return (
    <>
      <PageTitle title="Approvisionnements" sub="Commandes fournisseurs et réceptions"><button className={aBtn} onClick={() => setForm(true)}>+ Nouvelle commande</button></PageTitle>
      <ListView key={k} path="/admin/purchase-orders" listKey="purchaseOrders" cols={cols} filters={[{ key: 'status', label: 'Statut', type: 'select', options: Object.entries(PO_STATUS) }]} />
      {form && <POForm onClose={() => setForm(false)} onSaved={() => setK((x) => x + 1)} />}
      {view && <PODetail id={view} onClose={() => setView(null)} onChanged={() => setK((x) => x + 1)} />}
    </>
  );
}
