import type { Metadata } from 'next';
import Checkout from '@/components/Checkout';
import { PageHeader, Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Commande', robots: { index: false } };
export default function Page() { return <Shell><PageHeader badge="Paiement sécurisé" title="Finaliser ma commande" /><Checkout /></Shell>; }
