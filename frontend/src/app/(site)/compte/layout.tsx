import type { Metadata } from 'next';
import AccountShell from '@/components/account/AccountShell';

export const metadata: Metadata = { title: 'Mon compte', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <AccountShell>{children}</AccountShell>; }
