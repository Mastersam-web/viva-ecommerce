'use client';
import Link from 'next/link';
import { NotificationBell } from '../NotificationBell';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Loading, useCan } from './kit';

export const ADMIN_NAV: { href: string; label: string; icon: string; perms: string[]; group: string }[] = [
  { href: '/admin', label: 'Tableau de bord', icon: 'fa-chart-line', perms: ['dashboard.view'], group: 'Pilotage' },
  { href: '/admin/commandes', label: 'Commandes', icon: 'fa-box', perms: ['orders.view', 'orders.manage'], group: 'Ventes' },
  { href: '/admin/paiements', label: 'Paiements', icon: 'fa-credit-card', perms: ['payments.view', 'payments.manage'], group: 'Ventes' },
  { href: '/admin/livraisons', label: 'Livraisons', icon: 'fa-truck', perms: ['shipments.manage', 'deliveries.own'], group: 'Ventes' },
  { href: '/admin/retours', label: 'Retours', icon: 'fa-rotate-left', perms: ['returns.manage'], group: 'Ventes' },
  { href: '/admin/promotions', label: 'Promotions', icon: 'fa-ticket', perms: ['coupons.manage'], group: 'Ventes' },
  { href: '/admin/produits', label: 'Produits', icon: 'fa-shirt', perms: ['products.manage'], group: 'Catalogue' },
  { href: '/admin/categories', label: 'Catégories & marques', icon: 'fa-tags', perms: ['categories.manage'], group: 'Catalogue' },
  { href: '/admin/avis', label: 'Avis clients', icon: 'fa-star', perms: ['reviews.moderate'], group: 'Catalogue' },
  { href: '/admin/stocks', label: 'Stocks', icon: 'fa-warehouse', perms: ['stock.view', 'stock.manage'], group: 'Logistique' },
  { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: 'fa-industry', perms: ['suppliers.manage', 'stock.manage'], group: 'Logistique' },
  { href: '/admin/approvisionnements', label: 'Approvisionnements', icon: 'fa-dolly', perms: ['suppliers.manage', 'stock.manage'], group: 'Logistique' },
  { href: '/admin/clients', label: 'Clients', icon: 'fa-users', perms: ['customers.view', 'users.manage'], group: 'Clients' },
  { href: '/admin/support', label: 'Service client', icon: 'fa-headset', perms: ['support.manage'], group: 'Clients' },
  { href: '/admin/rapports', label: 'Rapports', icon: 'fa-file-excel', perms: ['reports.view'], group: 'Administration' },
  { href: '/admin/contenu', label: 'Contenu & blog', icon: 'fa-pen-nib', perms: ['content.manage'], group: 'Administration' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs & rôles', icon: 'fa-user-shield', perms: ['users.manage', 'roles.manage'], group: 'Administration' },
  { href: '/admin/parametres', label: 'Paramètres', icon: 'fa-gear', perms: ['settings.manage'], group: 'Administration' },
  { href: '/admin/audit', label: "Journal d'audit", icon: 'fa-clipboard-list', perms: ['audit.view'], group: 'Administration' },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, authReady, logout } = useStore(); const can = useCan();
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  useEffect(() => { if (authReady && !user) router.replace('/connexion?next=/admin'); else if (authReady && user && !user.isStaff) router.replace('/compte'); }, [authReady, user, router]);
  useEffect(() => setOpen(false), [path]);
  const items = ADMIN_NAV.filter((n) => can(...n.perms));
  // Redirection vers la première page autorisée (ex. livreur)
  useEffect(() => { if (authReady && user?.isStaff && path === '/admin' && !can('dashboard.view') && items[0]) router.replace(items[0].href); }, [authReady, user, path]); // eslint-disable-line
  if (!authReady || !user?.isStaff) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const nav = (
    <nav aria-label="Administration" className="space-y-5">
      {groups.map((g) => <div key={g}><p className="text-[10px] uppercase tracking-widest text-sage-300/70 font-extrabold px-3 mb-1">{g}</p>
        {items.filter((i) => i.group === g).map((i) => { const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href); return (
          <Link key={i.href} href={i.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-white text-pine-900' : 'text-sage-100 hover:bg-white/10'}`}><i className={`fa-solid ${i.icon} w-4 text-center`}></i>{i.label}</Link>); })}</div>)}
    </nav>
  );
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="hidden lg:block w-64 shrink-0 bg-pine-900 p-4 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
        <Link href="/admin" className="block text-white font-black text-lg tracking-tight px-3 py-4">VIVA <span className="text-emerald-300">Admin</span></Link>{nav}
      </aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 bottom-0 w-64 bg-pine-900 p-4 overflow-y-auto">{nav}</aside></div>}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b px-4 sm:px-8 h-14 flex items-center justify-between sticky top-0 z-40">
          <button className="lg:hidden text-pine-900" aria-label="Menu" onClick={() => setOpen(true)}><i className="fa-solid fa-bars"></i></button>
          <span className="hidden lg:block text-xs text-gray-500">{user.roles.join(', ')}</span>
          <div className="flex items-center gap-4 text-xs font-bold">
            <NotificationBell href="/admin/notifications" />
            <Link href="/" target="_blank" className="text-pine-900"><i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>Voir la boutique</Link>
            <span className="text-gray-600 hidden sm:inline">{user.first_name} {user.last_name}</span>
            <button onClick={async () => { await logout(); router.push('/connexion'); }} className="text-red-600"><i className="fa-solid fa-right-from-bracket"></i></button>
          </div>
        </header>
        <main className="p-4 sm:p-8 space-y-6">{children}</main>
      </div>
    </div>
  );
}
