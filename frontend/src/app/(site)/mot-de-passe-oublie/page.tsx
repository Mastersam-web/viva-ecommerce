import type { Metadata } from 'next';
import { Shell } from '@/components/ui';
import { ForgotForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false } };
export default function Page() { return <Shell narrow><ForgotForm /></Shell>; }
