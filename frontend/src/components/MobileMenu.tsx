'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { useAnimatedToggle } from '@/lib/useAnimatedToggle';

export default function MobileMenu() {
  const { mobileMenuOpen, setMobileMenuOpen, user, logout } = useStore();
  const { mounted, shown } = useAnimatedToggle(mobileMenuOpen);
  const pathname = usePathname();
  const router = useRouter();
  const close = () => setMobileMenuOpen(false);
  useEffect(() => { setMobileMenuOpen(false); }, [pathname, setMobileMenuOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMobileMenuOpen]);

  const item = (href: string, label: string, active: boolean) => (
    <Link href={href} onClick={close} className={`block w-full text-left py-2 border-b border-gray-100 ${active ? 'text-pine-900 font-bold' : 'hover:text-pine-900'}`}>{label}</Link>
  );

  return (
    <div className={`fixed inset-0 bg-black/50 z-50 ${mounted ? '' : 'hidden'} ${shown ? '' : 'opacity-0'} transition-opacity duration-300`}>
      <div className={`bg-white w-4/5 max-w-sm h-full p-6 overflow-y-auto transform ${shown ? '' : '-translate-x-full'} transition-transform duration-300`}>
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-leaf text-pine-900 text-xl"></i>
            <span className="font-extrabold text-lg text-pine-900">VIVA</span>
          </div>
          <button onClick={close} aria-label="Fermer" className="text-gray-500 hover:text-black">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        <div className="py-4 space-y-3 font-medium text-gray-700">
          {item('/', 'Accueil', pathname === '/')}
          {item('/boutique', 'Boutique', pathname === '/boutique')}
          {item('/a-propos', 'À Propos', pathname === '/a-propos')}
          {item('/contact', 'Contact', pathname === '/contact')}
          {item('/suivi', 'Suivre ma commande', pathname === '/suivi')}
          {user ? (
            <>
              {item('/compte', 'Mon compte', pathname === '/compte')}
              {item('/compte/commandes', 'Mes commandes', false)}
              {user.isStaff && item('/admin', 'Administration', false)}
              <button onClick={() => { close(); logout(); router.push('/'); }} className="block w-full text-left py-2 border-b border-gray-100 hover:text-pine-900">Déconnexion</button>
            </>
          ) : (
            <>
              {item('/connexion', 'Connexion', pathname === '/connexion')}
              {item('/inscription', 'Créer un compte', pathname === '/inscription')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
