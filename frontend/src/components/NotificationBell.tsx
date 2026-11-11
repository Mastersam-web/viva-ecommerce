'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/context/StoreContext';

/** Cloche de notifications avec compteur de non lus (interrogation toutes les 60 s). */
export function useUnread() {
  const { user } = useStore();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) { setN(0); return; }
    let on = true;
    const tick = () => api.get('/notifications/unread-count').then((r) => on && setN(r.count ?? r.unread ?? 0)).catch(() => null);
    tick();
    const t = setInterval(tick, 60000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus); window.addEventListener('viva:notifications', onFocus);
    return () => { on = false; clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener('viva:notifications', onFocus); };
  }, [user]);
  return n;
}

export function NotificationBell({ href, labelled = false, className = '' }: { href: string; labelled?: boolean; className?: string }) {
  const n = useUnread();
  return (
    <Link href={href} aria-label={`Notifications${n ? ` (${n} non lues)` : ''}`} className={`relative flex flex-col items-center group text-gray-700 hover:text-pine-900 transition ${className}`}>
      <div className="relative">
        <i className={`fa-regular fa-bell ${labelled ? 'text-lg' : 'text-base'} group-hover:scale-110 transition-transform`}></i>
        {n > 0 && <span className="absolute -top-2 -right-2.5 bg-accent-coral text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white">{n > 99 ? '99+' : n}</span>}
      </div>
      {labelled && <span className="text-[11px] font-medium hidden sm:block mt-0.5">Alertes</span>}
    </Link>
  );
}
