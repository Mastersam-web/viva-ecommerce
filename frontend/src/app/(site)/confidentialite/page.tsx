import type { Metadata } from 'next';
import ContentPage from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Politique de confidentialité', alternates: { canonical: '/confidentialite' } };
export const revalidate = 30;
export default function Page() { return <ContentPage name="privacy" badge="Vos données" title="Politique de confidentialité" />; }
