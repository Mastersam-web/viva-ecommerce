'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, dateFr, money } from '@/lib/api';
import { RETURN_STATUS, TICKET_STATUS } from '@/lib/labels';
import { useStore } from '@/context/StoreContext';
import Badge from '../Badge';
import ProductCard from '../ProductCard';
import { Alert, Field, Spinner, btnPrimary, btnSecondary, card, inputCls } from '../ui';

const Empty = ({ children }: { children: React.ReactNode }) => <div className={`${card} p-10 text-center text-sm text-gray-500`}>{children}</div>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-xl font-extrabold text-pine-900">{children}</h2>;

/* ---------- Profil ---------- */
export function Profile() {
  const { user, refreshUser, logout, showToast } = useStore(); const router = useRouter();
  const [p, setP] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' }); const [del, setDel] = useState('');
  const [e1, setE1] = useState(''); const [e2, setE2] = useState(''); const [e3, setE3] = useState('');
  const save = async (e: FormEvent) => { e.preventDefault(); setE1(''); try { await api.put('/account/profile', { ...p, phone: p.phone || null }); await refreshUser(); showToast('Profil mis à jour'); } catch (x: any) { setE1(x.message); } };
  const chg = async (e: FormEvent) => { e.preventDefault(); setE2(''); try { await api.put('/account/password', pw); setPw({ current_password: '', new_password: '' }); showToast('Mot de passe modifié'); } catch (x: any) { setE2(x.message); } };
  const rm = async (e: FormEvent) => { e.preventDefault(); setE3(''); if (!confirm('Supprimer définitivement votre compte ?')) return; try { await api.post('/account/delete', { password: del }); await logout(); router.push('/'); } catch (x: any) { setE3(x.message); } };
  return (
    <>
      <H>Mon profil</H>
      <form onSubmit={save} className={`${card} p-6 space-y-4`}>
        {e1 && <Alert>{e1}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Prénom"><input required value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} className={inputCls} /></Field>
          <Field label="Nom"><input required value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} className={inputCls} /></Field>
          <Field label="Email" hint={user?.email_verified ? 'Email vérifié' : 'Email non vérifié'}><input disabled value={user?.email} className={`${inputCls} opacity-60`} /></Field>
          <Field label="Téléphone"><input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} className={inputCls} /></Field>
        </div>
        <button className={btnPrimary}>Enregistrer</button>
      </form>
      <form onSubmit={chg} className={`${card} p-6 space-y-4`}>
        <h3 className="font-extrabold text-pine-900">Changer de mot de passe</h3>{e2 && <Alert>{e2}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Mot de passe actuel"><input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} className={inputCls} /></Field>
          <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec majuscule, minuscule et chiffre"><input type="password" required autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className={inputCls} /></Field>
        </div>
        <button className={btnSecondary}>Modifier</button>
      </form>
      <form onSubmit={rm} className={`${card} p-6 space-y-4 border-red-100`}>
        <h3 className="font-extrabold text-red-700">Supprimer mon compte</h3><p className="text-xs text-gray-500">Vos données personnelles seront anonymisées. Les commandes passées sont conservées pour obligations comptables.</p>{e3 && <Alert>{e3}</Alert>}
        <Field label="Confirmez avec votre mot de passe"><input type="password" required value={del} onChange={(e) => setDel(e.target.value)} className={inputCls} /></Field>
        <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-full text-sm">Supprimer mon compte</button>
      </form>
    </>
  );
}

/* ---------- Adresses ---------- */
const EMPTY = { label: '', full_name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'FR', is_default: false };
export function Addresses() {
  const { showToast } = useStore();
  const [list, setList] = useState<any[] | null>(null); const [form, setForm] = useState<any>(null); const [err, setErr] = useState('');
  const load = useCallback(() => api.get('/account/addresses').then((r) => setList(r.addresses)), []);
  useEffect(() => { load(); }, [load]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    const { id, user_id, created_at, updated_at, ...b } = form;
    const body = { ...b, label: b.label || null, line2: b.line2 || null, state: b.state || null, postal_code: b.postal_code || null, phone: b.phone || null, is_default: !!b.is_default };
    try { id ? await api.put(`/account/addresses/${id}`, body) : await api.post('/account/addresses', body); setForm(null); showToast('Adresse enregistrée'); load(); } catch (x: any) { setErr(x.message); }
  };
  const rm = async (id: number) => { if (!confirm('Supprimer cette adresse ?')) return; await api.del(`/account/addresses/${id}`); load(); };
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  if (!list) return <Spinner />;
  return (
    <>
      <div className="flex justify-between items-center"><H>Mes adresses</H>{!form && <button onClick={() => setForm({ ...EMPTY })} className={btnPrimary}>Ajouter</button>}</div>
      {form && (
        <form onSubmit={save} className={`${card} p-6 space-y-4`}>{err && <Alert>{err}</Alert>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Libellé (Maison, Bureau…)"><input value={form.label || ''} onChange={set('label')} className={inputCls} /></Field>
            <Field label="Nom complet"><input required value={form.full_name} onChange={set('full_name')} className={inputCls} /></Field>
            <Field label="Téléphone"><input value={form.phone || ''} onChange={set('phone')} className={inputCls} /></Field>
            <Field label="Pays (2 lettres)"><input required minLength={2} maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} className={inputCls} /></Field>
            <div className="sm:col-span-2"><Field label="Adresse"><input required value={form.line1} onChange={set('line1')} className={inputCls} /></Field></div>
            <div className="sm:col-span-2"><Field label="Complément"><input value={form.line2 || ''} onChange={set('line2')} className={inputCls} /></Field></div>
            <Field label="Ville"><input required value={form.city} onChange={set('city')} className={inputCls} /></Field>
            <Field label="Code postal"><input value={form.postal_code || ''} onChange={set('postal_code')} className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" className="accent-pine-900" checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />Adresse par défaut</label>
          <div className="flex gap-3"><button className={btnPrimary}>Enregistrer</button><button type="button" onClick={() => setForm(null)} className={btnSecondary}>Annuler</button></div>
        </form>)}
      {list.length === 0 && !form ? <Empty>Aucune adresse enregistrée.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">{list.map((a) => (
          <div key={a.id} className={`${card} p-5 text-xs space-y-1`}>
            <p className="font-extrabold text-sm text-gray-900">{a.full_name} {a.is_default ? <span className="ml-2 bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full">Par défaut</span> : null}</p>
            {a.label && <p className="text-gray-500">{a.label}</p>}<p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p><p>{a.postal_code} {a.city}, {a.country}</p>{a.phone && <p>{a.phone}</p>}
            <div className="pt-2 flex gap-3 font-bold"><button onClick={() => setForm({ ...a })} className="text-pine-900 underline">Modifier</button><button onClick={() => rm(a.id)} className="text-red-600 underline">Supprimer</button></div>
          </div>))}</div>)}
    </>
  );
}

/* ---------- Favoris ---------- */
export function Favorites() {
  const { wishlist } = useStore(); const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api.get('/wishlist').then((r) => setItems(r.products)); }, [wishlist.length]);
  if (!items) return <Spinner />;
  return <><H>Mes favoris</H>{items.length === 0 ? <Empty>Votre liste de favoris est vide. <Link href="/boutique" className="underline">Parcourir la boutique</Link></Empty> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>}</>;
}

/* ---------- Factures ---------- */
export function Invoices() {
  const [l, setL] = useState<any[] | null>(null);
  useEffect(() => { api.get('/account/invoices').then((r) => setL(r.invoices)); }, []);
  if (!l) return <Spinner />;
  return <><H>Mes factures</H>{l.length === 0 ? <Empty>Aucune facture disponible.</Empty> : (
    <div className={`${card} divide-y`}>{l.map((i) => (
      <div key={i.invoice_number} className="p-4 flex items-center justify-between gap-3 text-xs">
        <span><b className="text-gray-900">{i.invoice_number}</b><br /><span className="text-gray-500">Commande {i.order_number} · {dateFr(i.issued_at)}</span></span>
        <b className="text-pine-900">{money(i.total)}</b>
        <a href={`/api/orders/${i.order_id}/invoice.pdf`} target="_blank" rel="noreferrer" className={btnSecondary}><i className="fa-solid fa-download mr-2"></i>PDF</a>
      </div>))}</div>)}</>;
}

/* ---------- Retours ---------- */
export function Returns() {
  const [l, setL] = useState<any[] | null>(null);
  useEffect(() => { api.get('/returns').then((r) => setL(r.returns)); }, []);
  if (!l) return <Spinner />;
  return <><H>Mes retours</H>{l.length === 0 ? <Empty>Aucune demande de retour. Vous pouvez en créer une depuis le détail d'une commande livrée.</Empty> : (
    <div className="space-y-3">{l.map((r) => (
      <div key={r.id} className={`${card} p-5 text-xs space-y-1`}>
        <div className="flex justify-between items-center"><b className="text-sm text-gray-900">{r.product_name} × {r.quantity}</b><Badge map={RETURN_STATUS} value={r.status} /></div>
        <p className="text-gray-500">Commande {r.order_number} · {dateFr(r.created_at)}</p><p>Motif : {r.reason}</p>
        {r.admin_note && <p className="text-gray-600">Réponse : {r.admin_note}</p>}
      </div>))}</div>)}</>;
}

/* ---------- Avis ---------- */
export function MyReviews() {
  const { showToast } = useStore(); const [l, setL] = useState<any[] | null>(null);
  const load = useCallback(() => api.get('/account/reviews').then((r) => setL(r.reviews)), []);
  useEffect(() => { load(); }, [load]);
  const rm = async (pid: number) => { if (!confirm('Supprimer cet avis ?')) return; await api.del(`/products/${pid}/reviews`); showToast('Avis supprimé'); load(); };
  const st: Record<string, string> = { published: 'Publié', hidden: 'Masqué' };
  if (!l) return <Spinner />;
  return <><H>Mes avis</H>{l.length === 0 ? <Empty>Vous n'avez pas encore publié d'avis.</Empty> : (
    <div className="space-y-3">{l.map((r) => (
      <div key={r.id} className={`${card} p-5 text-xs space-y-1`}>
        <div className="flex justify-between"><Link href={`/produit/${r.slug}`} className="font-extrabold text-sm text-pine-900">{r.product_name}</Link><span className="text-gray-500">{st[r.status] || r.status}</span></div>
        <p className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>{r.title && <p className="font-bold">{r.title}</p>}<p className="text-gray-700">{r.comment}</p>
        <button onClick={() => rm(r.product_id)} className="text-red-600 underline font-bold pt-1">Supprimer</button>
      </div>))}</div>)}</>;
}

/* ---------- Notifications ---------- */
export function Notifications() {
  const [l, setL] = useState<any[] | null>(null);
  const load = useCallback(() => api.get('/notifications').then((r) => setL(r.notifications)), []);
  useEffect(() => { load(); }, [load]);
  const ping = () => window.dispatchEvent(new Event('viva:notifications'));
  const read = async (id: number) => { await api.post(`/notifications/${id}/read`); load(); ping(); };
  const all = async () => { await api.post('/notifications/read-all'); load(); ping(); };
  if (!l) return <Spinner />;
  return <><div className="flex justify-between items-center"><H>Notifications</H>{l.some((n) => !n.is_read) && <button onClick={all} className={btnSecondary}>Tout marquer comme lu</button>}</div>
    {l.length === 0 ? <Empty>Aucune notification.</Empty> : <div className={`${card} divide-y`}>{l.map((n) => (
      <div key={n.id} className={`p-4 text-xs flex items-start gap-3 ${n.is_read ? '' : 'bg-sage-50'}`}>
        <i className={`fa-solid fa-bell mt-0.5 ${n.is_read ? 'text-gray-300' : 'text-accent-600'}`}></i>
        <div className="flex-1"><b className="text-gray-900">{n.title}</b><p className="text-gray-600 whitespace-pre-line">{n.message}</p><p className="text-gray-400 text-[11px]">{dateFr(n.created_at, true)}</p>{n.link && <a href={n.link} onClick={() => { if (!n.is_read) api.post(`/notifications/${n.id}/read`).catch(() => null); }} className="inline-block mt-1 font-bold text-pine-900 hover:underline">Voir <i className="fa-solid fa-arrow-right text-[10px]"></i></a>}</div>
        {!n.is_read && <button onClick={() => read(n.id)} className="underline font-bold text-pine-900">Lu</button>}
      </div>))}</div>}</>;
}

/* ---------- Support ---------- */
export function Support() {
  const { user, showToast } = useStore();
  const [l, setL] = useState<any[] | null>(null); const [open, setOpen] = useState<any>(null); const [msgs, setMsgs] = useState<any[]>([]); const [reply, setReply] = useState('');
  const [f, setF] = useState({ subject: '', message: '', type: 'contact', orderNumber: '' }); const [err, setErr] = useState(''); const [show, setShow] = useState(false);
  const load = useCallback(() => api.get('/support/tickets').then((r) => setL(r.tickets)), []);
  useEffect(() => { load(); }, [load]);
  const view = async (id: number) => { const r = await api.get(`/support/tickets/${id}`); setOpen(r.ticket); setMsgs(r.messages); };
  const create = async (e: FormEvent) => { e.preventDefault(); setErr(''); try { await api.post('/support/tickets', { name: `${user!.first_name} ${user!.last_name}`, email: user!.email, subject: f.subject, message: f.message, type: f.type, orderNumber: f.orderNumber || undefined }); setShow(false); setF({ subject: '', message: '', type: 'contact', orderNumber: '' }); showToast('Demande envoyée'); load(); } catch (x: any) { setErr(x.message); } };
  const send = async (e: FormEvent) => { e.preventDefault(); try { await api.post(`/support/tickets/${open.id}/reply`, { message: reply }); setReply(''); view(open.id); } catch (x: any) { setErr(x.message); } };
  if (!l) return <Spinner />;
  if (open) return (
    <>
      <button onClick={() => { setOpen(null); load(); }} className="text-xs font-bold text-accent-600"><i className="fa-solid fa-arrow-left mr-1"></i>Mes demandes</button>
      <div className={`${card} p-6 space-y-4`}>
        <div className="flex justify-between items-center"><h2 className="font-extrabold text-pine-900">{open.subject}</h2><Badge map={TICKET_STATUS} value={open.status} /></div>
        {err && <Alert>{err}</Alert>}
        <div className="space-y-3">{msgs.map((m) => <div key={m.id} className={`text-xs rounded-2xl p-4 max-w-[85%] ${m.is_staff ? 'bg-sage-100' : 'bg-gray-50 ml-auto'}`}><b>{m.is_staff ? 'Service client' : 'Vous'}</b> · <span className="text-gray-400">{dateFr(m.created_at, true)}</span><p className="mt-1 whitespace-pre-wrap">{m.message}</p></div>)}</div>
        {open.status !== 'closed' && <form onSubmit={send} className="space-y-3"><textarea required rows={3} value={reply} onChange={(e) => setReply(e.target.value)} className={inputCls} placeholder="Votre réponse…" /><button className={btnPrimary}>Envoyer</button></form>}
      </div>
    </>
  );
  return (
    <>
      <div className="flex justify-between items-center"><H>Service client</H>{!show && <button onClick={() => setShow(true)} className={btnPrimary}>Nouvelle demande</button>}</div>
      {show && (
        <form onSubmit={create} className={`${card} p-6 space-y-4`}>{err && <Alert>{err}</Alert>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls}><option value="contact">Question</option><option value="complaint">Réclamation</option><option value="return">Retour</option><option value="refund">Remboursement</option></select></Field>
            <Field label="N° de commande (facultatif)"><input value={f.orderNumber} onChange={(e) => setF({ ...f, orderNumber: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Sujet"><input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={inputCls} /></Field>
          <Field label="Message"><textarea required rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={inputCls} /></Field>
          <div className="flex gap-3"><button className={btnPrimary}>Envoyer</button><button type="button" onClick={() => setShow(false)} className={btnSecondary}>Annuler</button></div>
        </form>)}
      {l.length === 0 ? <Empty>Aucune demande.</Empty> : <div className={`${card} divide-y`}>{l.map((t) => (
        <button key={t.id} onClick={() => view(t.id)} className="w-full text-left p-4 flex items-center justify-between gap-3 text-xs hover:bg-sage-50"><span><b className="text-gray-900">{t.subject}</b><br /><span className="text-gray-500">{t.ticket_number} · {dateFr(t.updated_at)}</span></span><Badge map={TICKET_STATUS} value={t.status} /></button>))}</div>}
    </>
  );
}
