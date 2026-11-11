import Link from 'next/link';
import { tabLabel } from '@/lib/categories';
import type { Category } from '@/types';

export default function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="bg-pine-900 text-sage-200 pt-12 pb-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-pine-800">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <i className="fa-solid fa-leaf text-lg"></i>
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">VIVA</span>
            </Link>
            <p className="text-xs text-sage-200/80 leading-relaxed max-w-sm">
              Viva Live Better est votre destination shopping privilégiée. Produits modernes, durables et élégants pour améliorer votre quotidien.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" aria-label="Facebook" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition text-xs"><i className="fa-brands fa-facebook-f"></i></a>
              <a href="#" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition text-xs"><i className="fa-brands fa-instagram"></i></a>
              <a href="#" aria-label="X" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition text-xs"><i className="fa-brands fa-x-twitter"></i></a>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/" className="hover:text-white transition">Accueil</Link></li>
              <li><Link href="/boutique" className="hover:text-white transition">Boutique</Link></li>
              <li><Link href="/a-propos" className="hover:text-white transition">À Propos</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Catégories</h4>
            <ul className="space-y-2 text-xs">
              {categories.filter((c) => !c.parent_id).slice(0, 4).map((c) => (
                <li key={c.id}><Link href={`/boutique?categorie=${c.slug}`} className="hover:text-white transition">{tabLabel(c.slug, c.name)}</Link></li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Aide</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/faq" className="hover:text-white transition">FAQ</Link></li>
              <li><Link href="/livraison" className="hover:text-white transition">Livraison</Link></li>
              <li><Link href="/retours" className="hover:text-white transition">Retours</Link></li>
              <li><Link href="/conditions-generales" className="hover:text-white transition">CGV</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-sage-300 gap-4">
          <p>&copy; {new Date().getFullYear()} Viva Live Better. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            <Link href="/confidentialite" className="hover:text-white transition">Confidentialité</Link>
            <Link href="/mentions-legales" className="hover:text-white transition">Mentions légales</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
