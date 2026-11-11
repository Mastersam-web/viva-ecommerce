import type { Metadata } from 'next';
import { Unsubscribe } from '@/components/Unsubscribe';
import { Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Désabonnement newsletter', robots: { index: false } };
export default function Page() { return <Shell narrow><Unsubscribe /></Shell>; }
