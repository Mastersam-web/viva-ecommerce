'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Comme navigateTo() de l'original : retour en haut en douceur à chaque changement de page. */
export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
}
