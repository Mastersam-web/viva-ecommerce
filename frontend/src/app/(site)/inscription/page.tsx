import type { Metadata } from 'next';
import { Shell } from '@/components/ui';
import { RegisterForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Inscription', robots: { index: false } };
export default function Page() { return <Shell narrow><RegisterForm /></Shell>; }
