export const dynamic = 'force-dynamic';
import SiteShell from '@/components/SiteShell';
import { serverGet } from '@/lib/server';
import type { Category } from '@/types';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const data = await serverGet<{ categories: Category[] }>('/categories', 60);
  return <SiteShell categories={data?.categories || []}>{children}</SiteShell>;
}
