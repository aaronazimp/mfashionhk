import { supabase } from '@/lib/supabase'
import OrderHistoryForm from '@/components/order-history-form'

type Props = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function OrderHistoryPage({ searchParams }: Props) {
  // `searchParams` can be a Promise in some Next.js setups — unwrap it first
  const resolvedSearchParams = await (searchParams as any)
  const whatsapp = Array.isArray(resolvedSearchParams?.whatsapp)
    ? String(resolvedSearchParams?.whatsapp[0])
    : resolvedSearchParams?.whatsapp

  if (!whatsapp) {
    // Render a small client form to collect whatsapp
    return <OrderHistoryForm />
  }

  // Call the RPC to fetch customer order history
  const { data, error } = await supabase.rpc('get_customer_order_history', { p_whatsapp: whatsapp })

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Order History</h1>
        <p className="mt-4 text-red-600">Failed to load orders: {error.message}</p>
      </div>
    )
  }

  const payload = (data ?? {}) as any

  const history = Array.isArray(payload.history) ? payload.history : []

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Order History</h1>
      <p className="text-sm text-muted-foreground">WhatsApp: {payload.whatsapp ?? whatsapp} · Total orders: {payload.total_orders ?? history.length}</p>

      <div className="mt-6 space-y-6">
        {history.length === 0 && <div>No orders found for this WhatsApp number.</div>}

        {history.map((order: any) => (
          <div key={order.base_order_no} className="border rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Order {order.base_order_no}</div>
            </div>

            <div className="mt-3 grid gap-4">
              {Array.isArray(order.items) && order.items.map((item: any) => (
                <div key={item.id} className="flex gap-4 items-center">
                  <img src={item.image_url} alt={item.sku_code} className="w-20 h-20 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-semibold">{item.sku_code} · {item.variation}</div>
                    <div className="text-sm text-muted-foreground">Qty: {item.quantity} · Price: ${item.price}</div>
                    <div className="text-sm">Created: {new Date(item.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="mb-2">
                      <span className="px-2 py-1 rounded bg-gray-100 text-sm">{item.status}</span>
                    </div>
                    {item.requires_payment && (
                      <div className="text-sm text-red-600">Requires payment by {item.payment_deadline ? new Date(item.payment_deadline).toLocaleString() : '—'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
