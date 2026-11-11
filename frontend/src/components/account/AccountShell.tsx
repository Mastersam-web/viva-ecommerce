'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { PageHeader, Shell, Spinner, card } from '../ui';

const NAV = [
  ['/compte', 'fa-gauge', 'Tableau de bord'], ['/compte/commandes', 'fa-box', 'Mes commandes'], ['/compte/favoris', 'fa-heart', 'Mes favoris'],
  ['/compte/adresses', 'fa-location-dot', 'Mes adresses'], ['/compte/factures', 'fa-file-invoice', 'Factures'], ['/compte/retours', 'fa-rotate-left', 'Retours'],
  ['/compte/avis', 'fa-star', 'Mes avis'], ['/compte/notifications', 'fa-bell', 'Notifications'], ['/compte/support', 'fa-headset', 'Service client'], ['/compte/profil', 'fa-user-gear', 'Mon profil'],
];

export default function AccountShell({ children }: { children: ReactNode }) {
  const { user, authReady, logout } = useStore();
  const path = usePathname(); const router = useRouter();
  useEffect(() => { if (authReady && !user) router.replace(`/connexion?next=${encodeURIComponent(path)}`); }, [authReady, user, path, router]);
  if (!authReady || !user) return <Shell><Spinner /></Shell>;
  return (
    <Shell>
      <PageHeader badge="Espace client" title={`Bonjour ${user.first_name}`} />
      <div className="grid lg:grid-cols-4 gap-8">
        <nav aria-label="Compte" className={`${card} p-3 h-fit flex lg:flex-col gap-1 overflow-x-auto`}>
          {NAV.map(([href, icon, label]) => {
            const active = href === '/compte' ? path === href : path.startsWith(href);
            return <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap ${active ? 'bg-pine-900 text-white' : 'text-gray-700 hover:bg-sage-100'}`}><i className={`fa-solid ${icon} w-4`}></i>{label}</Link>;
          })}
          {user.isStaff && <Link href="/admin" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-accent-600 hover:bg-sage-100 whitespace-nowrap"><i className="fa-solid fa-screwdriver-wrench w-4"></i>Administration</Link>}
          <button onClick={async () => { await logout(); router.push('/'); }} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 whitespace-nowrap text-left"><i className="fa-solid fa-right-from-bracket w-4"></i>Déconnexion</button>
        </nav>
        <div className="lg:col-span-3 space-y-6 min-w-0">{children}</div>
      </div>
    </Shell>
  );
}
