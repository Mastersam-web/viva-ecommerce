'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, dateFr, money } from '@/lib/api';
import { ORDER_STATUS } from '@/lib/labels';
import { useStore } from '@/context/StoreContext';
import Badge from '../Badge';
import { Alert, Spinner, btnSecondary, card } from '../ui';

export default function Dashboard() {
  const { user, wishlist, refreshUser } = useStore();
  const [orders, setOrders] = useState<any[] | null>(null); const [unread, setUnread] = useState(0); const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/orders?limit=5').then((r) => setOrders(r.orders)); api.get('/notifications').then((r) => setUnread(r.unread)).catch(() => null); }, []);
  const resend = async () => { try { await api.post('/auth/resend-verification'); setMsg('Email de vérification envoyé.'); } catch (e: any) { setMsg(e.message); } };
  if (!orders) return <Spinner />;
  return (
    <>
      {user && !user.email_verified && <Alert kind="info">Votre email n'est pas encore vérifié. <button onClick={resend} className="underline font-bold">Renvoyer le lien</button> {msg && <span className="ml-2">{msg}</span>}</Alert>}
      <div className="grid sm:grid-cols-3 gap-4">
        {[['Commandes', orders.length ? '/compte/commandes' : '/compte/commandes', 'fa-box', 'Voir'], ['Favoris', '/compte/favoris', 'fa-heart', String(wishlist.length)], ['Notifications', '/compte/notifications', 'fa-bell', String(unread)]].map(([t, h, i, v]) => (
          <Link key={t} href={h} className={`${card} p-5 flex items-center gap-4 hover:shadow-md transition`}><span className="w-11 h-11 rounded-2xl bg-sage-100 text-pine-900 flex items-center justify-center"><i className={`fa-solid ${i}`}></i></span><span><b className="block text-lg text-pine-900">{v}</b><span className="text-xs text-gray-500">{t}</span></span></Link>
        ))}
      </div>
      <section className={`${card} p-6`}>
        <div className="flex justify-between items-center mb-4"><h2 className="font-extrabold text-pine-900">Dernières commandes</h2><Link href="/compte/commandes" className="text-xs font-bold text-accent-600">Tout voir</Link></div>
        {orders.length === 0 ? <p className="text-sm text-gray-500">Aucune commande pour le moment. <Link href="/boutique" className="underline">Découvrir la boutique</Link></p> : (
          <ul className="divide-y">{orders.map((o) => (
            <li key={o.id}><Link href={`/compte/commandes/${o.id}`} className="py-3 flex items-center justify-between gap-3 text-xs"><span><b className="text-gray-900">{o.order_number}</b><br /><span className="text-gray-500">{dateFr(o.created_at)}</span></span><Badge map={ORDER_STATUS} value={o.status} /><b className="text-pine-900">{money(o.grand_total)}</b></Link></li>
          ))}</ul>
        )}
      </section>
      <div className="flex gap-3"><Link href="/suivi" className={btnSecondary}>Suivre un colis</Link><Link href="/compte/support" className={btnSecondary}>Contacter le support</Link></div>
    </>
  );
}
