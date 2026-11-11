'use client';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';

export default function TopBar() {
  const { settings } = useStore();
  const threshold = Number(settings['store.free_shipping_threshold'] ?? 49);
  const days = settings['store.return_days'] ?? '30';
  return (
    <div className="bg-pine-900 text-sage-100 text-xs py-2 px-4 font-medium tracking-wide border-b border-pine-800/50">
      <div className="max-w-7xl mx-auto flex justify-center md:justify-between items-center gap-4">
        <div className="flex items-center gap-6 sm:gap-10 text-center w-full md:w-auto justify-center">
          <Link href="/livraison" className="flex items-center gap-1.5 hover:text-white transition cursor-pointer">
            <i className="fa-solid fa-truck-fast text-emerald-400"></i> Livraison Gratuite Dès {threshold}$
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 opacity-40">|</span>
          <Link href="/retours" className="hidden sm:flex items-center gap-1.5 hover:text-white transition cursor-pointer">
            <i className="fa-solid fa-rotate-left text-emerald-400"></i> Retours Faciles Sous {days} Jours
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5 opacity-40">|</span>
          <span className="hidden md:flex items-center gap-1.5 hover:text-white transition cursor-pointer">
            <i className="fa-solid fa-shield-halved text-emerald-400"></i> Paiement 100% Sécurisé
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-xs">
          <Link href="/faq" className="hover:underline opacity-90 hover:opacity-100">Aide & FAQ</Link>
          <span>|</span>
          <Link href="/suivi" className="hover:underline opacity-90 hover:opacity-100">Suivre ma commande</Link>
        </div>
      </div>
    </div>
  );
}
