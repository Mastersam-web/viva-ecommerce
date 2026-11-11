import type { Metadata } from 'next';
import { Shell } from '@/components/ui';
import { VerifyForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Confirmation de votre email', robots: { index: false } };
export default function Page() { return <Shell narrow><VerifyForm /></Shell>; }
