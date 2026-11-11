import type { Metadata } from 'next';
import { Confirmation } from '@/components/OrderResult';
import { Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Commande confirmée', robots: { index: false } };
export default function Page() { return <Shell><Confirmation /></Shell>; }
