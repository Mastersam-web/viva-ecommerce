import type { Metadata } from 'next';
import ContentPage from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Politique de livraison', alternates: { canonical: '/livraison' } };
export const revalidate = 30;
export default function Page() { return <ContentPage name="shipping_policy" badge="Informations" title="Politique de livraison" />; }
