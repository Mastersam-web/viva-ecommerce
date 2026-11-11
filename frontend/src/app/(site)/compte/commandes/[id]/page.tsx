import { OrderDetail } from '@/components/account/Orders';
export default function Page({ params }: { params: { id: string } }) { return <OrderDetail id={params.id} />; }
