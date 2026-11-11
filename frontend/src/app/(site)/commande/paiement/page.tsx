import type { Metadata } from 'next';
import { PaymentPage } from '@/components/PaymentPage';
import { Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Paiement', robots: { index: false } };
export default function Page() { return <Shell><PaymentPage /></Shell>; }
