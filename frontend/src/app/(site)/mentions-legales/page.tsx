import type { Metadata } from 'next';
import ContentPage from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Mentions légales', alternates: { canonical: '/mentions-legales' } };
export const revalidate = 30;
export default function Page() { return <ContentPage name="legal" badge="Légal" title="Mentions légales" />; }
