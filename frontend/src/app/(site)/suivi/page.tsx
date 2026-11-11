import type { Metadata } from 'next';
import TrackForm from '@/components/TrackForm';
import { PageHeader, Shell } from '@/components/ui';

export const metadata: Metadata = { title: 'Suivre ma commande', description: 'Suivez votre colis avec votre numéro de commande.', alternates: { canonical: '/suivi' } };
export default function Page() { return <Shell><PageHeader badge="Livraison" title="Suivre ma commande" text="Entrez votre numéro de commande et l'email utilisé lors de l'achat." /><TrackForm /></Shell>; }
