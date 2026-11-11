import type { Metadata } from 'next';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s · Admin VIVA' }, robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminShell>{children}</AdminShell>; }
