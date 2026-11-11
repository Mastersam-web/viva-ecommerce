'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateFr, money, qs } from '@/lib/api';
import { ORDER_STATUS, PAYMENT_STATUS, TICKET_STATUS } from '@/lib/labels';
import { Col, FormModal, ListView, Loading, Modal, Msg, PageTitle, Pill, aBtn, aBtn2, aCard, aDanger, aInput, useApi, useCan, useToast } from './kit';

/* ----------------------------------------------------------- Clients */
export function Customers() {
  const [view, setView] = useState<number | null>(null); const detail = useApi<any>(view ? `/admin/customers/${view}` : null);
  const cols: Col[] = [
    { key: 'name', label: 'Client', render: (r) => <><b>{r.first_name} {r.last_name}</b>{!r.is_active && <span className="text-amber-700 font-bold"> · désactivé</span>}<br /><span className="text-gray-400">{r.email}</span></> }, { key: 'phone', label: 'Téléphone' },
    { key: 'orders_count', label: 'Commandes' }, { key: 'total_spent', label: 'Total dépensé', render: (r) => <b>{money(r.total_spent)}</b> }, { key: 'created_at', label: 'Inscrit le', render: (r) => dateFr(r.created_at) }, { key: 'last_login_at', label: 'Dernière connexion', render: (r) => (r.last_login_at ? dateFr(r.last_login_at, true) : '—') },
    { key: 'a', label: '', render: (r) => <button className={aBtn2} onClick={() => setView(r.id)}>Fiche</button> },
  ];
  const c = detail.data;
  return (
    <>
      <PageTitle title="Clients" sub="Base clients et historique d'achats" />
      <ListView path="/admin/customers" listKey="customers" cols={cols} filters={[{ key: 'q', label: 'Nom ou email' }]} />
      {view && <Modal title="Fiche client" onClose={() => setView(null)} wide>{!c ? <Loading /> : (
        <div className="space-y-5 text-xs">
          <div><p className="text-base font-extrabold text-pine-900">{c.customer.first_name} {c.customer.last_name}</p><p>{c.customer.email} {c.customer.phone && `· ${c.customer.phone}`}</p><p className="text-gray-500">Inscrit le {dateFr(c.customer.created_at)} · Email {c.customer.email_verified_at ? 'vérifié' : 'non vérifié'}</p></div>
          <section><h3 className="font-extrabold text-sm text-pine-900 mb-2">Commandes</h3>{c.orders.length === 0 ? <p className="text-gray-400">Aucune commande.</p> : <div className="divide-y border rounded-xl">{c.orders.map((o: any) => <Link key={o.id} href={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-sage-50"><b>{o.order_number}</b><Pill map={ORDER_STATUS} v={o.status} /><Pill map={PAYMENT_STATUS} v={o.payment_status} /><b>{money(o.grand_total)}</b><span className="text-gray-400">{dateFr(o.created_at)}</span></Link>)}</div>}</section>
          <section><h3 className="font-extrabold text-sm text-pine-900 mb-2">Adresses</h3>{c.addresses.map((a: any) => <p key={a.id}>{a.full_name}, {a.line1}, {a.postal_code} {a.city}, {a.country}</p>)}{c.addresses.length === 0 && <p className="text-gray-400">Aucune.</p>}</section>
        </div>)}</Modal>}
    </>
  );
}

/* ----------------------------------------------------------- Utilisateurs & rôles */
export function UsersRoles() {
  const can = useCan(); const [tab, setTab] = useState<'u' | 'r'>(can('users.manage') ? 'u' : 'r');
  return (
    <>
      <PageTitle title="Utilisateurs & rôles" sub="Équipe, accès et permissions" />
      <div className="flex gap-2">{can('users.manage') && <button onClick={() => setTab('u')} className={tab === 'u' ? aBtn : aBtn2}>Utilisateurs</button>}{can('roles.manage', 'users.manage') && <button onClick={() => setTab('r')} className={tab === 'r' ? aBtn : aBtn2}>Rôles & permissions</button>}</div>
      {tab === 'u' ? <Users /> : <Roles />}
    </>
  );
}
function Users() {
  const toast = useToast(); const roles = useApi<any>('/admin/roles'); const [edit, setEdit] = useState<any>(undefined); const [k, setK] = useState(0);
  const cols: Col[] = [
    { key: 'name', label: 'Utilisateur', render: (r) => <><b>{r.first_name} {r.last_name}</b><br /><span className="text-gray-400">{r.email}</span></> },
    { key: 'roles', label: 'Rôles', render: (r) => <div className="flex flex-wrap gap-1">{r.roles.map((x: string) => <span key={x} className="bg-sage-100 text-pine-900 text-[11px] font-bold px-2 py-0.5 rounded-full">{x}</span>)}</div> },
    { key: 'is_active', label: 'État', render: (r) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{r.is_active ? 'Actif' : 'Désactivé'}</span> },
    { key: 'last_login_at', label: 'Dernière connexion', render: (r) => (r.last_login_at ? dateFr(r.last_login_at, true) : '—') },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={async () => { const d = await api.get(`/admin/users/${r.id}`); setEdit({ ...d.user, roles: d.user.roleIds }); }}>Modifier</button>
      <button className={aBtn2} onClick={async () => { if (!confirm('Fermer les sessions et envoyer un lien de réinitialisation ?')) return; try { const x = await api.post(`/admin/users/${r.id}/reset-access`, {}); toast(x.message); } catch (e: any) { toast(e.message); } }}>Réinit. accès</button></div> },
  ];
  const opts = (roles.data?.roles || []).map((r: any) => [r.id, r.name] as [number, string]);
  return (
    <>
      <div className="flex justify-end"><button className={aBtn} onClick={() => setEdit({ is_active: 1, roles: [] })}>+ Nouvel utilisateur</button></div>
      <ListView key={k} path="/admin/users" listKey="users" cols={cols} filters={[{ key: 'q', label: 'Nom ou email' }, { key: 'role', label: 'Rôle', type: 'select', options: (roles.data?.roles || []).map((r: any) => [r.code, r.name]) }]} />
      {edit && <FormModal title={edit.id ? "Modifier l'utilisateur" : 'Nouvel utilisateur'} initial={edit} onClose={() => setEdit(undefined)}
        fields={[{ name: 'first_name', label: 'Prénom', required: true, half: true }, { name: 'last_name', label: 'Nom', required: true, half: true }, { name: 'email', label: 'Email', type: 'email', required: true, half: true }, { name: 'phone', label: 'Téléphone', half: true },
          { name: 'password', label: edit.id ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe', type: 'password', required: !edit.id, hint: '8 caractères min., majuscule, minuscule et chiffre' }, { name: 'roles', label: 'Rôles', type: 'checks', options: opts }, { name: 'is_active', label: 'Compte actif', type: 'checkbox' }]}
        onSubmit={async (v) => { const b: any = { first_name: v.first_name, last_name: v.last_name, email: v.email, phone: v.phone || null, is_active: v.is_active ? 1 : 0, roles: (v.roles || []).map(Number) }; if (v.password) b.password = v.password; edit.id ? await api.put(`/admin/users/${edit.id}`, b) : await api.post('/admin/users', b); toast('Utilisateur enregistré'); setK((x) => x + 1); }} />}
    </>
  );
}
function Roles() {
  const toast = useToast(); const { data, loading, reload } = useApi<any>('/admin/roles'); const can = useCan(); const [edit, setEdit] = useState<any>(undefined);
  if (loading && !data) return <Loading />;
  const perms = (data?.permissions || []).map((p: any) => [p.id, `${p.code} — ${p.description || ''}`] as [number, string]);
  return (
    <>
      {can('roles.manage') && <div className="flex justify-end"><button className={aBtn} onClick={() => setEdit({ permissions: [] })}>+ Nouveau rôle</button></div>}
      <div className="grid md:grid-cols-2 gap-4">{(data?.roles || []).map((r: any) => (
        <div key={r.id} className={`${aCard} p-5 space-y-2 text-xs`}><div className="flex items-center justify-between"><b className="text-sm text-pine-900">{r.name}</b><code className="text-gray-400">{r.code}</code></div><p className="text-gray-500">{r.description}</p>
          <p className="text-gray-600">{r.code === 'admin' ? 'Toutes les permissions' : `${r.permissions.length} permission(s)`}</p>
          {can('roles.manage') && r.code !== 'admin' && <div className="flex gap-2"><button className={aBtn2} onClick={() => setEdit(r)}>Modifier</button>{!r.is_system && <button className={aDanger} onClick={async () => { if (!confirm('Supprimer ce rôle ?')) return; try { await api.del(`/admin/roles/${r.id}`); reload(); } catch (e: any) { toast(e.message); } }}>Supprimer</button>}</div>}</div>))}</div>
      {edit && <FormModal title={edit.id ? 'Modifier le rôle' : 'Nouveau rôle'} initial={edit} onClose={() => setEdit(undefined)}
        fields={[{ name: 'code', label: 'Code (minuscules et _)', required: true, half: true }, { name: 'name', label: 'Nom', required: true, half: true }, { name: 'description', label: 'Description' }, { name: 'permissions', label: 'Permissions', type: 'checks', options: perms }]}
        onSubmit={async (v) => { const b = { code: v.code, name: v.name, description: v.description || null, permissions: (v.permissions || []).map(Number) }; edit.id ? await api.put(`/admin/roles/${edit.id}`, b) : await api.post('/admin/roles', b); toast('Rôle enregistré'); reload(); }} />}
    </>
  );
}

/* ----------------------------------------------------------- Rapports */
export function Reports() {
  const types = useApi<any>('/admin/reports'); const today = new Date().toISOString().slice(0, 10); const ago = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [type, setType] = useState('sales'); const [from, setFrom] = useState(ago); const [to, setTo] = useState(today); const [group, setGroup] = useState('day');
  const q = qs({ from, to, group: type === 'sales' ? group : undefined });
  const { data, loading, error } = useApi<any>(`/admin/reports/${type}${q}`);
  const dl = (format: string) => window.open(`/api/admin/reports/${type}${qs({ from, to, group: type === 'sales' ? group : undefined, format })}`, '_blank');
  const fmt = (v: any) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? dateFr(v) : v ?? '—');
  return (
    <>
      <PageTitle title="Rapports" sub="Analyses et exports Excel / PDF">
        <button className={aBtn} onClick={() => dl('xlsx')}><i className="fa-solid fa-file-excel mr-1"></i>Excel</button><button className={aBtn} onClick={() => dl('pdf')}><i className="fa-solid fa-file-pdf mr-1"></i>PDF</button></PageTitle>
      <div className="flex flex-wrap gap-2 items-end">
        <select aria-label="Rapport" value={type} onChange={(e) => setType(e.target.value)} className={`${aInput} !w-64`}>{(types.data?.reports || []).map((r: any) => <option key={r.key} value={r.key}>{r.title}</option>)}</select>
        <label className="text-xs font-bold">Du <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${aInput} !w-auto`} /></label>
        <label className="text-xs font-bold">Au <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${aInput} !w-auto`} /></label>
        {type === 'sales' && <select aria-label="Regroupement" value={group} onChange={(e) => setGroup(e.target.value)} className={`${aInput} !w-auto`}><option value="day">Par jour</option><option value="month">Par mois</option></select>}
      </div>
      {error && <Msg>{error}</Msg>}
      {loading && !data ? <Loading /> : data && (
        <div className={`${aCard} overflow-x-auto`}><table className="w-full text-xs"><thead><tr className="text-left bg-gray-50 border-b text-gray-500">{data.columns.map((c: any) => <th key={c.key} className="px-4 py-3 whitespace-nowrap">{c.label}</th>)}</tr></thead>
          <tbody className="divide-y">{data.rows.length === 0 && <tr><td colSpan={data.columns.length} className="px-4 py-10 text-center text-gray-400">Aucune donnée sur la période.</td></tr>}{data.rows.map((r: any, i: number) => <tr key={i}>{data.columns.map((c: any) => <td key={c.key} className="px-4 py-2 whitespace-nowrap">{fmt(r[c.key])}</td>)}</tr>)}</tbody></table></div>)}
    </>
  );
}

/* ----------------------------------------------------------- Paramètres */
const SETTINGS: [string, string, string?][] = [
  ['store.name', 'Nom de la boutique'], ['store.contact_email', 'Email de contact'], ['store.contact_phone', 'Téléphone'], ['store.contact_address', 'Adresse'],
  ['store.currency', 'Devise (code ISO)'], ['store.default_country', 'Pays par défaut (2 lettres)'], ['store.tax_rate', 'Taux de TVA (%)', 'number'],
  ['store.free_shipping_threshold', 'Seuil de livraison gratuite', 'number'], ['store.return_days', 'Délai de retour (jours)', 'number'], ['store.low_stock_default', "Seuil d'alerte stock par défaut", 'number'],
];
export function Settings() {
  const toast = useToast(); const { data, loading } = useApi<any>('/admin/settings'); const [v, setV] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (data) setV(data.settings); }, [data]);
  if (loading || !data) return <Loading />;
  const save = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { const b: Record<string, string> = {}; SETTINGS.forEach(([k]) => (b[k] = String(v[k] ?? ''))); b['auth.require_verified_email'] = v['auth.require_verified_email'] === 'true' ? 'true' : 'false'; b['orders.auto_confirm'] = v['orders.auto_confirm'] === 'true' ? 'true' : 'false'; await api.put('/admin/settings', b); toast('Paramètres enregistrés'); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <>
      <PageTitle title="Paramètres" sub="Configuration générale de la boutique" />
      <form onSubmit={save} className={`${aCard} p-6 space-y-4 max-w-2xl`}>{err && <Msg>{err}</Msg>}
        {SETTINGS.map(([k, l, t]) => <div key={k}><label className="text-xs font-bold text-gray-700">{l}</label><input type={t || 'text'} step={t ? 'any' : undefined} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={aInput} /></div>)}
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" className="accent-pine-900" checked={v['auth.require_verified_email'] === 'true'} onChange={(e) => setV({ ...v, 'auth.require_verified_email': e.target.checked ? 'true' : 'false' })} />Exiger un email vérifié pour commander</label>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" className="accent-pine-900" checked={v['orders.auto_confirm'] === 'true'} onChange={(e) => setV({ ...v, 'orders.auto_confirm': e.target.checked ? 'true' : 'false' })} />Confirmer automatiquement les commandes payées <span className="font-normal text-gray-500">(sinon, seul l'administrateur change les statuts)</span></label>
        <p className="text-[11px] text-gray-400">Les clés API de paiement, SMTP et secrets se configurent dans le fichier .env du serveur (jamais dans l'interface).</p>
        <button disabled={busy} className={aBtn}>{busy ? '…' : 'Enregistrer'}</button></form>
    </>
  );
}

/* ----------------------------------------------------------- Contenu & blog */
const CONTENT_LABEL: Record<string, string> = { hero: "Accueil — bandeau principal (JSON)", banners: 'Accueil — bannières promotionnelles (JSON)', about: 'À propos (section complémentaire, HTML)', contact: 'Contact (texte complémentaire, HTML)', cgv: 'Conditions générales de vente', privacy: 'Politique de confidentialité', shipping_policy: 'Politique de livraison', return_policy: 'Politique de retour', legal: 'Mentions légales', faq: 'FAQ (JSON : [{"q":"…","a":"…"}])' };
export function Content() {
  const [tab, setTab] = useState<'c' | 'b'>('c');
  return <><PageTitle title="Contenu & blog" sub="Pages éditables, bannières et articles" /><div className="flex gap-2">{([['c', 'Pages & bannières'], ['b', 'Articles de blog']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? aBtn : aBtn2}>{l}</button>)}</div>{tab === 'c' ? <Pages /> : <Posts />}</>;
}
function Pages() {
  const toast = useToast(); const list = useApi<any>('/admin/content'); const [name, setName] = useState<string | null>(null); const [val, setVal] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { if (!name) return; setVal(''); setErr(''); api.get(`/admin/content/${name}`).then((r) => setVal(r.value || '')); }, [name]);
  const save = async () => { setErr(''); try { if (['hero', 'banners', 'faq'].includes(name!) && val.trim()) JSON.parse(val); await api.put(`/admin/content/${name}`, { value: val }); toast('Contenu enregistré'); setName(null); list.reload(); } catch (e: any) { setErr(e instanceof SyntaxError ? 'JSON invalide' : e.message); } };
  return (
    <>
      <div className={`${aCard} divide-y`}>{(list.data?.items || []).map((i: any) => <div key={i.name} className="p-3 flex items-center gap-3 text-xs"><b className="flex-1">{CONTENT_LABEL[i.name] || i.name}</b><span className={i.filled ? 'text-emerald-700 font-bold' : 'text-gray-400'}>{i.filled ? `Personnalisé · ${dateFr(i.updatedAt)}` : 'Contenu par défaut'}</span><button className={aBtn2} onClick={() => setName(i.name)}>Modifier</button></div>)}</div>
      {name && <Modal title={CONTENT_LABEL[name] || name} onClose={() => setName(null)} wide>
        {err && <Msg>{err}</Msg>}
        <p className="text-[11px] text-gray-500 my-2">{['hero', 'banners', 'faq'].includes(name) ? 'Format JSON. Videz le champ pour revenir au contenu par défaut.' : 'HTML simple (titres h2/h3, paragraphes, listes). Videz le champ pour revenir au texte par défaut.'}{name === 'hero' && ' Clés : saleLabel, saleUpTo, saleValue, saleOff, title, subtitle, cta, image.'}{name === 'banners' && ' Chaque bannière : tag, title, category, image, theme (sage|amber|blue).'}</p>
        <textarea rows={16} value={val} onChange={(e) => setVal(e.target.value)} className={`${aInput} font-mono text-xs`} aria-label="Contenu" spellCheck={false} />
        <div className="flex justify-end gap-2 pt-3"><button className={aBtn2} onClick={() => setName(null)}>Annuler</button><button className={aBtn} onClick={save}>Enregistrer</button></div></Modal>}
    </>
  );
}
function Posts() {
  const toast = useToast(); const [edit, setEdit] = useState<any>(undefined); const [k, setK] = useState(0);
  const cols = (reload: () => void): Col[] => [
    { key: 'title', label: 'Titre', render: (r) => <b>{r.title}</b> }, { key: 'status', label: 'Statut', render: (r) => (r.status === 'published' ? <span className="text-emerald-700 font-bold">Publié</span> : <span className="text-gray-500">Brouillon</span>) },
    { key: 'updated_at', label: 'Modifié', render: (r) => dateFr(r.updated_at) },
    { key: 'a', label: '', render: (r) => <div className="flex gap-2 justify-end"><button className={aBtn2} onClick={async () => setEdit((await api.get(`/admin/posts/${r.id}`)).post)}>Modifier</button><button className={aDanger} onClick={async () => { if (confirm('Supprimer cet article ?')) { await api.del(`/admin/posts/${r.id}`); reload(); } }}>Supprimer</button></div> },
  ];
  return (
    <>
      <div className="flex justify-end"><button className={aBtn} onClick={() => setEdit({ status: 'draft' })}>+ Nouvel article</button></div>
      <ListView key={k} path="/admin/posts" listKey="posts" cols={cols} />
      {edit && <FormModal title={edit.id ? "Modifier l'article" : 'Nouvel article'} initial={edit} onClose={() => setEdit(undefined)}
        fields={[{ name: 'title', label: 'Titre', required: true }, { name: 'slug', label: 'Slug (auto si vide)', half: true }, { name: 'status', label: 'Statut', type: 'select', options: [['draft', 'Brouillon'], ['published', 'Publié']], half: true }, { name: 'cover_url', label: "URL de l'image de couverture" }, { name: 'excerpt', label: 'Résumé', type: 'textarea' }, { name: 'content', label: 'Contenu (HTML)', type: 'textarea', rows: 10 }]}
        onSubmit={async (v) => { const b = { title: v.title, slug: v.slug || null, excerpt: v.excerpt || null, content: v.content || null, cover_url: v.cover_url || null, status: v.status || 'draft' }; edit.id ? await api.put(`/admin/posts/${edit.id}`, b) : await api.post('/admin/posts', b); toast('Article enregistré'); setK((x) => x + 1); }} />}
    </>
  );
}

/* ----------------------------------------------------------- Support & newsletter */
export function Support() {
  const toast = useToast(); const [tab, setTab] = useState<'t' | 'n'>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'newsletter' ? 'n' : 't')); const [open, setOpen] = useState<number | null>(null); const [reply, setReply] = useState(''); const [k, setK] = useState(0);
  const d = useApi<any>(open ? `/admin/support/tickets/${open}?k=${k}` : null); const [nk, setNk] = useState(0); const [nl, setNl] = useState({ subject: '', content: '' }); const [sending, setSending] = useState(false);
  const news = useApi<any>(tab === 'n' ? `/admin/newsletter?k=${nk}` : null);
  const sendNews = async (e: React.FormEvent) => { e.preventDefault(); if (!confirm(`Envoyer cette newsletter à ${news.data?.subscribers?.length || 0} abonné(s) ?`)) return; setSending(true); try { const r = await api.post('/admin/newsletter/send', { subject: nl.subject, content: nl.content }); toast(r.message || 'Newsletter en cours d\'envoi'); setNl({ subject: '', content: '' }); } catch (x: any) { toast(x.message); } setSending(false); };
  const TYPE: Record<string, string> = { contact: 'Question', complaint: 'Réclamation', return: 'Retour', refund: 'Remboursement' };
  const cols: Col[] = [
    { key: 'ticket_number', label: 'N°', render: (r) => <b>{r.ticket_number}</b> }, { key: 'subject', label: 'Sujet', render: (r) => <>{r.subject}<br /><span className="text-gray-400">{r.name} · {r.email}</span></> }, { key: 'type', label: 'Type', render: (r) => TYPE[r.type] || r.type },
    { key: 'status', label: 'Statut', render: (r) => <Pill map={TICKET_STATUS} v={r.status} /> }, { key: 'messages', label: 'Msgs' }, { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at) },
    { key: 'a', label: '', render: (r) => <button className={aBtn2} onClick={() => setOpen(r.id)}>Ouvrir</button> },
  ];
  const patch = async (b: any) => { await api.patch(`/admin/support/tickets/${open}`, b); setK((x) => x + 1); };
  return (
    <>
      <PageTitle title="Service client" sub="Demandes, réclamations et newsletter" />
      <div className="flex gap-2">{([['t', 'Demandes'], ['n', 'Abonnés newsletter']] as const).map(([x, l]) => <button key={x} onClick={() => setTab(x)} className={tab === x ? aBtn : aBtn2}>{l}</button>)}</div>
      {tab === 't' ? <ListView key={k} path="/admin/support/tickets" listKey="tickets" cols={cols} filters={[{ key: 'status', label: 'Statut', type: 'select', options: Object.entries(TICKET_STATUS).map(([a, b]) => [a, b.label]) }, { key: 'type', label: 'Type', type: 'select', options: Object.entries(TYPE) }]} />
        : !news.data ? <Loading /> : <div className="space-y-2"><div className="flex justify-between items-center"><p className="text-xs text-gray-500">{news.data.subscribers.length} abonné(s)</p><button className={aBtn2} onClick={() => { const csv = 'email,date\n' + news.data.subscribers.map((s: any) => `${s.email},${s.created_at}`).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'newsletter.csv'; a.click(); }}>Exporter CSV</button></div>
          <form onSubmit={sendNews} className={`${aCard} p-4 space-y-2`}><h3 className="text-xs font-extrabold text-pine-900">Envoyer une newsletter</h3>
            <input required value={nl.subject} onChange={(e) => setNl({ ...nl, subject: e.target.value })} placeholder="Objet" className={aInput} />
            <textarea required rows={5} value={nl.content} onChange={(e) => setNl({ ...nl, content: e.target.value })} placeholder="Contenu du message (un lien de désabonnement est ajouté automatiquement)" className={aInput} />
            <button disabled={sending || !news.data.subscribers.length} className={aBtn}>{sending ? '…' : 'Envoyer aux abonnés'}</button></form>
          <div className={`${aCard} divide-y max-h-[60vh] overflow-y-auto`}>{news.data.subscribers.map((s: any) => <div key={s.id} className="p-3 text-xs flex justify-between items-center gap-3"><span>{s.email}</span><span className="text-gray-400 flex-1 text-right">{dateFr(s.created_at)}</span><button className={aDanger} onClick={async () => { if (!confirm(`Supprimer ${s.email} ?`)) return; try { await api.del(`/admin/newsletter/${s.id}`); setNk((x) => x + 1); } catch (x: any) { toast(x.message); } }}>Supprimer</button></div>)}</div></div>}
      {open && <Modal title={d.data ? `${d.data.ticket.ticket_number} — ${d.data.ticket.subject}` : 'Demande'} onClose={() => { setOpen(null); setK((x) => x + 1); }} wide>
        {!d.data ? <Loading /> : <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2"><Pill map={TICKET_STATUS} v={d.data.ticket.status} /><span>{d.data.ticket.name} · {d.data.ticket.email}</span>{d.data.ticket.order_number && <span>· Commande {d.data.ticket.order_number}</span>}<span className="flex-1" />
            <select aria-label="Statut" value={d.data.ticket.status} onChange={(e) => patch({ status: e.target.value })} className={`${aInput} !w-auto`}>{Object.entries(TICKET_STATUS).map(([a, b]) => <option key={a} value={a}>{b.label}</option>)}</select></div>
          <div className="space-y-2">{d.data.messages.map((m: any) => <div key={m.id} className={`rounded-xl p-3 max-w-[85%] ${m.is_staff ? 'bg-sage-100 ml-auto' : 'bg-gray-50'}`}><b>{m.is_staff ? m.author || 'Équipe' : d.data.ticket.name}</b> <span className="text-gray-400">· {dateFr(m.created_at, true)}</span><p className="whitespace-pre-wrap mt-1">{m.message}</p></div>)}</div>
          <form onSubmit={async (e) => { e.preventDefault(); try { await patch({ message: reply }); setReply(''); toast('Réponse envoyée par email'); } catch (x: any) { toast(x.message); } }} className="space-y-2"><textarea required rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Votre réponse (envoyée au client par email)…" className={aInput} /><button className={aBtn}>Envoyer la réponse</button></form></div>}</Modal>}
    </>
  );
}

/* ----------------------------------------------------------- Audit */
export function Audit() {
  const cols: Col[] = [
    { key: 'created_at', label: 'Date', render: (r) => dateFr(r.created_at, true) }, { key: 'user_name', label: 'Utilisateur', render: (r) => r.user_name || '—' }, { key: 'action', label: 'Action', render: (r) => <code className="text-pine-900 font-bold">{r.action}</code> },
    { key: 'entity', label: 'Objet', render: (r) => `${r.entity || ''}${r.entity_id ? ` #${r.entity_id}` : ''}` }, { key: 'ip', label: 'IP' },
    { key: 'details', label: 'Détails', render: (r) => <span className="text-gray-500 line-clamp-2 max-w-xs break-all">{typeof r.details === 'string' ? r.details : JSON.stringify(r.details || '')}</span> },
  ];
  return <><PageTitle title="Journal d'audit" sub="Traçabilité des actions sensibles" /><ListView path="/admin/audit-logs" listKey="logs" cols={cols} filters={[{ key: 'action', label: 'Action (préfixe, ex. order.)' }, { key: 'entity', label: 'Objet (ex. product)' }]} /></>;
}
