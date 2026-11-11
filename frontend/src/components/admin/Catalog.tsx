'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, money } from '@/lib/api';
import { Col, FormModal, ListView, Loading, Modal, Msg, PageTitle, aBtn, aBtn2, aCard, aDanger, aInput, clean, toLocalInput, useApi, useCan, useToast } from './kit';

const slugOpt = (l: any[]): [number, string][] => l.map((x) => [x.id, x.name]);

/* ----------------------------------------------------------- Produits */
function ProductForm({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const cats = useApi<any>('/admin/categories'); const brands = useApi<any>('/admin/brands'); const prod = useApi<any>(id ? `/admin/products/${id}` : null);
  const [v, setV] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  const base = id ? prod.data?.product : { status: 'active', price: '', quantity: 0, low_stock_threshold: 5, images: [], variants: [], specs: {}, is_featured: 0 };
  const cur = v || (base && { ...base, sale_starts_at: toLocalInput(base.sale_starts_at), sale_ends_at: toLocalInput(base.sale_ends_at), specsText: Object.entries(base.specs || {}).map(([k, x]) => `${k}: ${x}`).join('\n') });
  if (!cur || cats.loading || brands.loading) return <Modal title="Produit" onClose={onClose}><Loading /></Modal>;
  const set = (k: string, val: any) => setV({ ...cur, [k]: val });
  const f = (name: string, label: string, props: any = {}) => (
    <div className={props.full ? 'sm:col-span-2' : ''}><label className="text-xs font-bold text-gray-700">{label}</label>
      {props.area ? <textarea rows={props.rows || 3} value={cur[name] ?? ''} onChange={(e) => set(name, e.target.value)} className={aInput} /> : <input type={props.type || 'text'} step={props.step} min={props.min} required={props.required} value={cur[name] ?? ''} onChange={(e) => set(name, e.target.value)} className={aInput} />}</div>
  );
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setUp(true); setErr('');
    try { const urls = await api.upload(files); set('images', [...cur.images, ...urls.map((u: string) => ({ url: u, alt: cur.name || '', is_primary: 0 }))].map((x: any, i: number) => ({ ...x, is_primary: i === 0 ? 1 : x.is_primary }))); } catch (e: any) { setErr(e.message); } finally { setUp(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const specs: Record<string, string> = {}; (cur.specsText || '').split('\n').forEach((l: string) => { const i = l.indexOf(':'); if (i > 0) specs[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    const body = {
      ...clean({ sku: cur.sku, name: cur.name, slug: cur.slug, short_description: cur.short_description, description: cur.description, category_id: cur.category_id, brand_id: cur.brand_id, price: cur.price, sale_price: cur.sale_price, weight_kg: cur.weight_kg, status: cur.status },
        ['category_id', 'brand_id', 'price', 'sale_price', 'weight_kg']),
      sale_starts_at: cur.sale_starts_at ? new Date(cur.sale_starts_at).toISOString() : null, sale_ends_at: cur.sale_ends_at ? new Date(cur.sale_ends_at).toISOString() : null,
      is_featured: cur.is_featured ? 1 : 0, quantity: Number(cur.quantity || 0), low_stock_threshold: Number(cur.low_stock_threshold || 0), specs,
      images: cur.images.map((i: any, n: number) => ({ url: i.url, alt: i.alt || null, is_primary: n === 0 ? 1 : 0 })),
      variants: cur.variants.map((x: any) => ({ id: x.id || undefined, sku: x.sku, name: x.name, attributes: x.attributes || {}, price_override: x.price_override === '' || x.price_override == null ? null : Number(x.price_override), is_active: x.is_active ? 1 : 0, quantity: Number(x.quantity || 0) })),
    };
    try { id ? await api.put(`/admin/products/${id}`, body) : await api.post('/admin/products', body); toast('Produit enregistré'); onSaved(); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const setVar = (i: number, k: string, val: any) => set('variants', cur.variants.map((x: any, n: number) => (n === i ? { ...x, [k]: val } : x)));
  return (
    <Modal title={id ? 'Modifier le produit' : 'Nouveau produit'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        {err && <Msg>{err}</Msg>}
        <div className="grid sm:grid-cols-2 gap-4">
          {f('name', 'Nom *', { required: true, full: true })}{f('sku', 'SKU *', { required: true })}{f('slug', 'Slug (auto si vide)')}
          <div><label className="text-xs font-bold text-gray-700">Catégorie</label><select value={cur.category_id ?? ''} onChange={(e) => set('category_id', e.target.value)} className={aInput}><option value="">—</option>{slugOpt(cats.data.categories).map(([i, n]) => <option key={i} value={i}>{n}</option>)}</select></div>
          <div><label className="text-xs font-bold text-gray-700">Marque</label><select value={cur.brand_id ?? ''} onChange={(e) => set('brand_id', e.target.value)} className={aInput}><option value="">—</option>{slugOpt(brands.data.brands).map(([i, n]) => <option key={i} value={i}>{n}</option>)}</select></div>
          {f('price', 'Prix de base *', { type: 'number', step: '0.01', min: 0, required: true })}{f('sale_price', 'Prix promotionnel', { type: 'number', step: '0.01', min: 0 })}
          {f('sale_starts_at', 'Début de la promo', { type: 'datetime-local' })}{f('sale_ends_at', 'Fin de la promo', { type: 'datetime-local' })}
          {f('quantity', 'Stock (produit sans variantes)', { type: 'number', min: 0 })}{f('low_stock_threshold', "Seuil d'alerte stock", { type: 'number', min: 0 })}
          {f('weight_kg', 'Poids (kg)', { type: 'number', step: '0.01', min: 0 })}
          <div><label className="text-xs font-bold text-gray-700">Statut</label><select value={cur.status} onChange={(e) => set('status', e.target.value)} className={aInput}><option value="active">Actif</option><option value="draft">Brouillon</option><option value="archived">Archivé</option></select></div>
          {f('short_description', 'Description courte', { full: true })}{f('description', 'Description complète', { area: true, rows: 5, full: true })}
          {f('specsText', 'Caractéristiques (une par ligne, « Nom: valeur »)', { area: true, full: true })}
          <label className="flex items-center gap-2 text-xs font-bold sm:col-span-2"><input type="checkbox" className="accent-pine-900" checked={!!cur.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />Produit mis en avant</label>
        </div>
        <section className="space-y-2"><h3 className="text-sm font-extrabold text-pine-900">Images</h3>
          <div className="flex flex-wrap gap-3">{cur.images.map((im: any, i: number) => (
            <div key={im.url + i} className="relative w-24"><div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={im.url} alt="" className="w-full h-full object-cover" /></div>
              {i === 0 && <span className="absolute top-1 left-1 bg-pine-900 text-white text-[9px] px-1.5 rounded">Principale</span>}
              <div className="flex justify-between text-[11px] mt-1">{i > 0 ? <button type="button" className="underline" onClick={() => set('images', [im, ...cur.images.filter((_: any, n: number) => n !== i)])}>Principale</button> : <span />}<button type="button" className="text-red-600 underline" onClick={() => set('images', cur.images.filter((_: any, n: number) => n !== i))}>Retirer</button></div></div>))}</div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => upload(e.target.files)} className="text-xs" aria-label="Ajouter des images" />{up && <span className="text-xs text-gray-500 ml-2">Envoi…</span>}
          <p className="text-[11px] text-gray-400">JPG, PNG, WebP ou GIF — 5 Mo max par image.</p></section>
        <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-pine-900">Variantes (taille, couleur…)</h3><button type="button" className={aBtn2} onClick={() => set('variants', [...cur.variants, { sku: '', name: '', price_override: '', is_active: 1, quantity: 0, attributes: {} }])}>+ Ajouter</button></div>
          {cur.variants.length > 0 && <p className="text-[11px] text-gray-400">Avec des variantes, le stock se gère par variante.</p>}
          {cur.variants.map((x: any, i: number) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end bg-gray-50 rounded-xl p-3">
              <input placeholder="SKU" required value={x.sku} onChange={(e) => setVar(i, 'sku', e.target.value)} className={aInput} aria-label="SKU variante" />
              <input placeholder="Nom (ex. M)" required value={x.name} onChange={(e) => setVar(i, 'name', e.target.value)} className={aInput} aria-label="Nom variante" />
              <input placeholder="Prix spécifique" type="number" step="0.01" value={x.price_override ?? ''} onChange={(e) => setVar(i, 'price_override', e.target.value)} className={aInput} aria-label="Prix variante" />
              <input placeholder="Stock" type="number" min={0} value={x.quantity} onChange={(e) => setVar(i, 'quantity', e.target.value)} className={aInput} aria-label="Stock variante" />
              <label className="text-xs flex items-center gap-1"><input type="checkbox" className="accent-pine-900" checked={!!x.is_active} onChange={(e) => setVar(i, 'is_active', e.target.checked ? 1 : 0)} />Active</label>
              <button type="button" className={aDanger} onClick={() => set('variants', cur.variants.filter((_: any, n: number) => n !== i))}>Retirer</button></div>))}
        </section>
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className={aBtn2}>Annuler</button><button disabled={busy || up} className={aBtn}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
    </Modal>
  );
}

export function Products() {
  const toast = useToast(); const [edit, setEdit] = useState<number | null | undefined>(undefined); const [k, setK] = useState(0);
  const cats = useApi<any>('/admin/categories');
  const cols = (reload: () => void): Col[] => [
    { key: 'image', label: '', render: (r) => r.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" /> : <span className="block w-10 h-10 rounded-lg bg-gray-100" /> },
    { key: 'name', label: 'Produit', render: (r) => <><b className="text-gray-900">{r.name}</b><br /><span className="text-gray-400">{r.sku}</span></> },
    { key: 'category_name', label: 'Catégorie' },
    { key: 'price', label: 'Prix', render: (r) => r.sale_price != null && Number(r.sale_price) < Number(r.price) ? <><b>{money(r.sale_price)}</b> <s className="text-gray-400">{money(r.price)}</s></> : <b>{money(r.price)}</b> },
    { key: 'stock', label: 'Stock', render: (r) => <span className={Number(r.stock) <= 0 ? 'text-red-600 font-bold' : ''}>{r.stock}</span> },
    { key: 'status', label: 'Statut', render: (r) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-100 text-emerald-800' : r.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>{{ active: 'Actif', draft: 'Brouillon', archived: 'Archivé' }[r.status as string]}</span> },
    { key: 'actions', label: '', render: (r) => <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={() => setEdit(r.id)}>Modifier</button>
      <button className={aDanger} onClick={async () => { if (!confirm(`Supprimer « ${r.name} » ?`)) return; try { const x = await api.del(`/admin/products/${r.id}`); toast(x.message || 'Produit supprimé'); reload(); } catch (e: any) { toast(e.message); } }}>Supprimer</button></div> },
  ];
  return (
    <>
      <PageTitle title="Produits" sub="Catalogue, prix, stock et images"><button className={aBtn} onClick={() => setEdit(null)}><i className="fa-solid fa-plus mr-1"></i>Nouveau produit</button></PageTitle>
      <ListView key={k} path="/admin/products" listKey="products" cols={cols}
        filters={[{ key: 'q', label: 'Rechercher (nom, SKU)' }, { key: 'category', label: 'Catégorie', type: 'select', options: (cats.data?.categories || []).map((c: any) => [String(c.id), c.name]) }, { key: 'status', label: 'Statut', type: 'select', options: [['active', 'Actif'], ['draft', 'Brouillon'], ['archived', 'Archivé']] }, { key: 'stock', label: 'Stock', type: 'select', options: [['out', 'En rupture'], ['low', 'Stock faible']] }]} />
      {edit !== undefined && <ProductForm id={edit} onClose={() => setEdit(undefined)} onSaved={() => setK((x) => x + 1)} />}
    </>
  );
}

/* ----------------------------------------------------------- Catégories & marques */
function Taxonomy({ kind }: { kind: 'categories' | 'brands' }) {
  const toast = useToast(); const { data, loading, reload } = useApi<any>(`/admin/${kind}`); const [edit, setEdit] = useState<any>(undefined);
  const isCat = kind === 'categories';
  if (loading && !data) return <Loading />;
  const list = data?.[kind] || [];
  const fields: any[] = [{ name: 'name', label: 'Nom', required: true }, { name: 'slug', label: 'Slug (auto si vide)', half: true }];
  if (isCat) fields.push({ name: 'parent_id', label: 'Catégorie parente', type: 'select', options: list.filter((c: any) => c.id !== edit?.id && !c.parent_id).map((c: any) => [c.id, c.name]), half: true },
    { name: 'icon', label: 'Icône Font Awesome (ex. fa-laptop)', half: true }, { name: 'sort_order', label: 'Ordre', type: 'number', half: true }, { name: 'description', label: 'Description', type: 'textarea' });
  fields.push({ name: 'is_active', label: 'Active', type: 'checkbox' });
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-extrabold text-pine-900">{isCat ? 'Catégories' : 'Marques'}</h2><button className={aBtn} onClick={() => setEdit({ is_active: 1, sort_order: 0 })}>+ Ajouter</button></div>
      <div className={`${aCard} divide-y`}>{list.length === 0 && <p className="p-6 text-center text-xs text-gray-400">Aucun élément.</p>}{list.map((c: any) => (
        <div key={c.id} className="p-3 flex items-center gap-3 text-xs">
          {isCat && <i className={`fa-solid ${c.icon || 'fa-tag'} w-5 text-center text-pine-900`}></i>}
          <div className="flex-1"><b>{c.parent_id ? '↳ ' : ''}{c.name}</b> <span className="text-gray-400">/{c.slug} · {c.product_count} produit(s)</span>{!c.is_active && <span className="ml-2 text-amber-700 font-bold">inactive</span>}</div>
          <button className={aBtn2} onClick={() => setEdit(c)}>Modifier</button>
          <button className={aDanger} onClick={async () => { if (!confirm('Supprimer ?')) return; try { await api.del(`/admin/${kind}/${c.id}`); toast('Supprimé'); reload(); } catch (e: any) { toast(e.message); } }}>Supprimer</button></div>))}</div>
      {edit && <FormModal title={edit.id ? 'Modifier' : 'Ajouter'} fields={fields} initial={edit} onClose={() => setEdit(undefined)}
        onSubmit={async (v) => { const b = clean(v, ['parent_id', 'sort_order'], isCat ? [] : []); delete (b as any).id; delete (b as any).product_count; delete (b as any).created_at; delete (b as any).updated_at; if (isCat) b.sort_order = Number(v.sort_order || 0); b.is_active = v.is_active ? 1 : 0; edit.id ? await api.put(`/admin/${kind}/${edit.id}`, b) : await api.post(`/admin/${kind}`, b); toast('Enregistré'); reload(); }} />}
    </section>
  );
}
export function Taxonomies() { return <><PageTitle title="Catégories & marques" /><div className="grid lg:grid-cols-2 gap-8"><Taxonomy kind="categories" /><Taxonomy kind="brands" /></div></>; }

/* ----------------------------------------------------------- Avis */
export function Reviews() {
  const toast = useToast();
  const cols = (reload: () => void): Col[] => [
    { key: 'product_name', label: 'Produit' }, { key: 'author', label: 'Client' },
    { key: 'rating', label: 'Note', render: (r) => <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> },
    { key: 'comment', label: 'Avis', render: (r) => <div className="max-w-sm">{r.title && <b>{r.title}<br /></b>}<span className="line-clamp-3">{r.comment}</span></div> },
    { key: 'status', label: 'Statut', render: (r) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{r.status === 'published' ? 'Publié' : 'Masqué'}</span> },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end">
      <button className={aBtn2} onClick={async () => { await api.patch(`/admin/reviews/${r.id}`, { status: r.status === 'published' ? 'hidden' : 'published' }); toast('Avis mis à jour'); reload(); }}>{r.status === 'published' ? 'Masquer' : 'Publier'}</button>
      <button className={aDanger} onClick={async () => { if (!confirm('Supprimer cet avis ?')) return; await api.del(`/admin/reviews/${r.id}`); reload(); }}>Supprimer</button></div> },
  ];
  return <><PageTitle title="Avis clients" sub="Modération des avis" /><ListView path="/admin/reviews" listKey="reviews" cols={cols} filters={[{ key: 'status', label: 'Statut', type: 'select', options: [['published', 'Publiés'], ['hidden', 'Masqués']] }, { key: 'rating', label: 'Note', type: 'select', options: [1, 2, 3, 4, 5].map((n) => [String(n), `${n} ★`]) }]} /></>;
}
