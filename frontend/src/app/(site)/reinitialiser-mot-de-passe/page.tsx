import type { Metadata } from 'next';
import { Shell } from '@/components/ui';
import { ResetForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false } };
export default function Page() { return <Shell narrow><ResetForm /></Shell>; }
