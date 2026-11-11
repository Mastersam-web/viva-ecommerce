import type { Metadata } from 'next';
import ContentPage from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Politique de retour', alternates: { canonical: '/retours' } };
export const revalidate = 30;
export default function Page() { return <ContentPage name="return_policy" badge="Retours faciles" title="Politique de retour" />; }
