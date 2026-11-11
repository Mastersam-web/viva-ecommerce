export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './globals.css';
import { serverGet, SITE_URL } from '@/lib/server';
import { StoreProvider } from '@/context/StoreContext';
import Toasts from '@/components/Toasts';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'VIVA LIVE BETTER - Store Officiel', template: '%s | VIVA Live Better' },
  description: 'Découvrez des produits de qualité dans toutes les catégories : électronique, mode, maison, beauté, sports et jouets. Livraison gratuite dès 49$.',
  openGraph: { siteName: 'VIVA Live Better', type: 'website', locale: 'fr_FR' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await serverGet<{ settings: Record<string, string> }>('/settings', 60);
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-50 text-gray-800 font-sans antialiased selection:bg-pine-900 selection:text-white flex flex-col min-h-screen">
        <StoreProvider settings={data?.settings || {}}>
          {children}
          <Toasts />
        </StoreProvider>
      </body>
    </html>
  );
}
