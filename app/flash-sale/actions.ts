'use server'

import { redirect } from 'next/navigation'
import { createReelsOrderWithQuota } from '@/lib/orderService'

export async function registerReelsOrder(formData: FormData) {
  const name = formData.get('name') as string
  const whatsapp = formData.get('whatsapp') as string
  const email = (formData.get('email') as string) || ''
  
  const rawSkuId = formData.get('skuId')
  const skuId = rawSkuId ? parseInt(rawSkuId as string) : 0
  
  const rawVariationId = formData.get('variationId')
  const variationId = rawVariationId ? parseInt(rawVariationId as string) : 0
  
  // Optional: Add server-side validation here
  if (!name || !whatsapp || !skuId || !variationId) {
    return { error: 'Missing required fields' }
  }

  try {
    const data = await createReelsOrderWithQuota(
      name,
      whatsapp,
      email,
      skuId,
      variationId
    )

    // The service throws on RPC error; continue below to handle result
    if (!data) {
      return { error: 'No data returned from server' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderData = data as any
    const { order_id, status } = orderData

    if (status === 'confirmed') {
      redirect(`/pay/${order_id}`)
    } else if (status === 'waitlist') {
      redirect(`/reels/status/${order_id}`)
    } else {
      return { error: `Received unknown order status: ${status}` }
    }
  } catch (err) {
    console.error('Error creating order:', err)
    return { error: (err as Error).message || 'Error occurred while creating order' }
  }
}
