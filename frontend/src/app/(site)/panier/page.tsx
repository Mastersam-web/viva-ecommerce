import type { Metadata } from 'next';
import CartView from '@/components/CartView';
import { PageHeader, Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Mon panier', robots: { index: false } };
export default function Page() { return <Shell><PageHeader badge="Panier" title="Mon panier" /><CartView /></Shell>; }
