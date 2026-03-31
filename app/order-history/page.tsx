import { getCustomerOrderHistory } from '@/lib/orderService'
import type { CustomerOrderHistoryResponse } from '@/types/order'
import OrderHistoryForm from '@/components/order-history-form'
import OrderCardReadOnly from '@/components/OrderCardReadOnly'
import Link from 'next/link'

type Props = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function OrderHistoryPage({ searchParams }: Props) {
  // `searchParams` can be a Promise in some Next.js setups — unwrap it first
  const resolvedSearchParams = await (searchParams as any)
  const whatsapp = Array.isArray(resolvedSearchParams?.whatsapp)
    ? String(resolvedSearchParams?.whatsapp[0])
    : resolvedSearchParams?.whatsapp

  const transactionId = Array.isArray(resolvedSearchParams?.transaction_id)
    ? String(resolvedSearchParams?.transaction_id[0])
    : resolvedSearchParams?.transaction_id ?? ''

  // Sticky buttons component (rendered in both form and results views)
  const StickyButtons = () => (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none z-50">
      <div className="pointer-events-auto flex gap-2">
        <Link href="/flash-sale" className="bg-primary text-white text-xs px-4 py-2 rounded-full shadow-lg hover:opacity-95 transition-opacity">
          返回首頁
        </Link>
       
      </div>
    </div>
  )

  if (!whatsapp) {
    // Render a small client form to collect whatsapp — keep sticky buttons visible
    return (
      <div className="p-6 max-w-[90vw] mx-auto">
        <OrderHistoryForm />
        <StickyButtons />
      </div>
    )
  }

  // Call the service helper to fetch customer order history
  let payload: CustomerOrderHistoryResponse
  try {
    payload = (await getCustomerOrderHistory(whatsapp, transactionId)) as any
  } catch (err: any) {
    return (
      <div className="p-6">
        <h1 className="text-sm font-semibold">訂單記錄</h1>
        <p className="mt-4 text-red-600">無法加載訂單: {err?.message ?? String(err)}</p>
      </div>
    )
  }

  const history = Array.isArray(payload.history) ? payload.history : []

  return (
    <div className="p-6 max-w-[90vw] mx-auto">
      <h1 className="text-sm font-semibold mb-9 text-center">訂單記錄</h1>
      <p className="text-sm font-bold">交易編號: {payload.transaction_id}</p>
      <div className="flex-col gap-2 mt-2">
      <p className="text-xs mb-2">顧客名稱: { payload.customer_name} | WhatsApp: {payload.whatsapp} </p>
      <p className="text-xs"> 共 {payload.total_orders}張訂單</p>
      </div>

      <div className="mt-9 space-y-6 items-center w-full flex flex-col justify-start sm:justify-start sm:min-h-screen">
          {history.length === 0 && <div>未找到訂單</div>}

          {history.map((order: any) => (
            <div key={order.base_order_no} className="w-[350px] overflow-hidden shadow-xl rounded-2xl">
              <div className="bg-primary text-white text-center text-xs rounded-t-2xl py-2">
                <span>訂單# {order.base_order_no}</span>
              </div>
              <div className="p-2 bg-white items-center justify-start flex">
                <OrderCardReadOnly order={order} hideHeader className=" rounded-2xl shadow-none " />
              </div>
            </div>
          ))}
      </div>
      {/* Sticky return buttons */}
      <StickyButtons />
    </div>
  )
}
