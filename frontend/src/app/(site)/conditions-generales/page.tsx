import type { Metadata } from 'next';
import ContentPage from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Conditions générales de vente', alternates: { canonical: '/conditions-generales' } };
export const revalidate = 30;
export default function Page() { return <ContentPage name="cgv" badge="Légal" title="Conditions générales de vente" />; }
