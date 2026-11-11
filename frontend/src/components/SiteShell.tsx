import TopBar from './TopBar';
import Header from './Header';
import MobileMenu from './MobileMenu';
import Newsletter from './Newsletter';
import TrustBar from './TrustBar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import WishlistModal from './WishlistModal';
import ScrollToTop from './ScrollToTop';
import type { Category } from '@/types';

/** Ordre identique à l'original : barre d'info, en-tête, menu mobile, contenu, newsletter, réassurance, pied de page, tiroir panier, favoris. */
export default function SiteShell({ categories, children }: { categories: Category[]; children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <Header categories={categories} />
      <MobileMenu />
      <main className="flex-grow">{children}</main>
      <Newsletter />
      <TrustBar />
      <Footer categories={categories} />
      <CartDrawer />
      <WishlistModal />
      <ScrollToTop />
    </>
  );
}
