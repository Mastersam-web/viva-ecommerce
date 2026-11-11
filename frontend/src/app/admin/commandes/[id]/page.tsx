'use client';
import { OrderDetail } from '@/components/admin/Sales';
export default function Page({ params }: { params: { id: string } }) { return <OrderDetail id={params.id} />; }
