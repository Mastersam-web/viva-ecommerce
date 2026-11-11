'use client';
import Link from 'next/link';
import { NotificationBell } from './NotificationBell';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { catIcon } from '@/lib/categories';
import type { Category } from '@/types';

function HeaderInner({ categories }: { categories: Category[] }) {
  const { cartCount, wishlist, setCartOpen, setWishlistOpen, setMobileMenuOpen, user, logout } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [accountOpen, setAccountOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (pathname !== '/boutique') setQ(''); }, [pathname]);
  useEffect(() => { setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const goSearch = (value: string) => {
    const v = value.trim();
    if (v) router.push(`/boutique?q=${encodeURIComponent(v)}`);
  };
  const onType = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => goSearch(value), 400);
  };

  const navClass = (active: boolean) =>
    `nav-link py-3 px-3 border-b-2 ${active ? 'border-pine-900 text-pine-900 font-bold' : 'border-transparent hover:border-pine-900 hover:text-pine-900 transition'}`;

  return (
    <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4 md:gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-pine-900 group-hover:bg-pine-900 group-hover:text-white transition-all duration-300">
              <i className="fa-solid fa-leaf text-xl"></i>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-pine-900 leading-none">VIVA</span>
              <span className="text-[10px] font-bold tracking-widest text-emerald-700 uppercase leading-none mt-1">Live Better</span>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-2xl relative">
            <div className="relative w-full flex items-center">
              <input
                type="text" value={q} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goSearch(q)}
                placeholder="Rechercher des produits, marques..." aria-label="Rechercher"
                className="w-full bg-gray-100/80 border border-transparent rounded-full py-2.5 pl-5 pr-12 text-sm focus:bg-white focus:border-pine-900 focus:outline-none transition-all duration-200"
              />
              <button onClick={() => goSearch(q)} aria-label="Lancer la recherche" className="absolute right-1.5 w-9 h-9 bg-pine-900 hover:bg-pine-800 text-white rounded-full flex items-center justify-center transition shadow-sm">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </button>
            </div>
          </div>

          {/* Controls Top Right */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative hidden sm:block" ref={accountRef}>
              {user ? (
                <button onClick={() => setAccountOpen((o) => !o)} className="flex flex-col items-center group text-gray-700 hover:text-pine-900 transition">
                  <i className="fa-regular fa-user text-lg mb-0.5 group-hover:scale-110 transition-transform"></i>
                  <span className="text-[11px] font-medium max-w-[72px] truncate">{user.first_name}</span>
                </button>
              ) : (
                <Link href="/connexion" className="flex flex-col items-center group text-gray-700 hover:text-pine-900 transition">
                  <i className="fa-regular fa-user text-lg mb-0.5 group-hover:scale-110 transition-transform"></i>
                  <span className="text-[11px] font-medium">Compte</span>
                </Link>
              )}
              {user && accountOpen && (
                <div className="absolute top-full right-0 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-2 mt-2">
                  <p className="px-3 py-2 text-[11px] text-gray-400 truncate">{user.email}</p>
                  {[
                    ['/compte', 'fa-gauge', 'Mon compte'],
                    ['/compte/commandes', 'fa-box', 'Mes commandes'],
                    ['/compte/favoris', 'fa-heart', 'Mes favoris'],
                    ['/compte/notifications', 'fa-bell', 'Notifications'],
                  ].map(([href, icon, label]) => (
                    <Link key={href} href={href} className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sage-100 hover:text-pine-900 rounded-xl transition">
                      <i className={`fa-solid ${icon} w-4 text-center`}></i> {label}
                    </Link>
                  ))}
                  {user.isStaff && (
                    <Link href={user.permissions.includes('dashboard.view') || user.isAdmin ? '/admin' : '/admin/livraisons'} className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs font-semibold text-pine-900 hover:bg-sage-100 rounded-xl transition">
                      <i className="fa-solid fa-sliders w-4 text-center"></i> Administration
                    </Link>
                  )}
                  <button onClick={() => { setAccountOpen(false); logout(); router.push('/'); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sage-100 hover:text-pine-900 rounded-xl transition">
                    <i className="fa-solid fa-right-from-bracket w-4 text-center"></i> Déconnexion
                  </button>
                </div>
              )}
            </div>

            {user && <NotificationBell href="/compte/notifications" labelled />}

            {/* Wishlist */}
            <button onClick={() => setWishlistOpen(true)} className="relative flex flex-col items-center group text-gray-700 hover:text-pine-900 transition">
              <div className="relative">
                <i className="fa-regular fa-heart text-lg group-hover:scale-110 transition-transform"></i>
                <span className="absolute -top-2 -right-2.5 bg-accent-coral text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{wishlist.length}</span>
              </div>
              <span className="text-[11px] font-medium hidden sm:block mt-0.5">Favoris</span>
            </button>

            {/* Cart Button */}
            <button onClick={() => setCartOpen(true)} className="relative flex flex-col items-center group text-gray-700 hover:text-pine-900 transition">
              <div className="relative">
                <i className="fa-solid fa-bag-shopping text-lg group-hover:scale-110 transition-transform"></i>
                <span className="absolute -top-2 -right-2.5 bg-pine-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{cartCount}</span>
              </div>
              <span className="text-[11px] font-medium hidden sm:block mt-0.5">Panier</span>
            </button>

            {/* Mobile Menu Button */}
            <button onClick={() => setMobileMenuOpen(true)} aria-label="Menu" className="md:hidden text-gray-700 hover:text-pine-900 p-1">
              <i className="fa-solid fa-bars text-xl"></i>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-3 md:hidden">
          <div className="relative w-full flex items-center">
            <input
              type="text" onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length > 2) onType(e.target.value); }}
              onKeyDown={(e) => e.key === 'Enter' && goSearch(q)} placeholder="Rechercher des produits..." aria-label="Rechercher"
              className="w-full bg-gray-100 border border-transparent rounded-full py-2 pl-4 pr-10 text-sm focus:bg-white focus:border-pine-900 focus:outline-none"
            />
            <button onClick={() => goSearch(q)} aria-label="Lancer la recherche" className="absolute right-1 w-7 h-7 bg-pine-900 text-white rounded-full flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <nav className="border-t border-gray-100 hidden md:block bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1 lg:space-x-6 font-medium text-gray-700">
            {/* Dropdown Toutes Catégories */}
            <div className="relative group py-2.5">
              <button className="bg-pine-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium hover:bg-pine-800 transition shadow-sm">
                <i className="fa-solid fa-border-all text-xs"></i>
                <span>Toutes Catégories</span>
                <i className="fa-solid fa-chevron-down text-[10px] opacity-70 group-hover:rotate-180 transition-transform"></i>
              </button>
              <div className="absolute top-full left-0 w-60 bg-white border border-gray-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2 mt-1">
                {categories.filter((c) => !c.parent_id).map((c) => (
                  <Link key={c.id} href={`/boutique?categorie=${c.slug}`} className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-sage-100 hover:text-pine-900 rounded-xl transition">
                    <i className={`fa-solid ${catIcon(c.icon)} w-4 text-center`}></i> {c.name}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/" className={navClass(pathname === '/')}>Accueil</Link>
            <Link href="/boutique" className={navClass(pathname === '/boutique' || pathname.startsWith('/produit'))}>Boutique</Link>
            <Link href="/a-propos" className={navClass(pathname === '/a-propos')}>À Propos</Link>
            <Link href="/contact" className={navClass(pathname === '/contact')}>Contact</Link>
          </div>

          <Link href="/suivi" className="flex items-center gap-2 text-xs font-semibold text-pine-900 bg-sage-100/70 py-1.5 px-3 rounded-full cursor-pointer hover:bg-sage-200 transition">
            <i className="fa-solid fa-location-dot"></i>
            <span>Suivre ma commande</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function Header(props: { categories: Category[] }) {
  return (
    <Suspense fallback={<header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100 h-[110px]" />}>
      <HeaderInner {...props} />
    </Suspense>
  );
}
