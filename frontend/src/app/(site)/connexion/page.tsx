import type { Metadata } from 'next';
import { Shell } from '@/components/ui';
import { LoginForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } };
export default function Page() { return <Shell narrow><LoginForm /></Shell>; }
