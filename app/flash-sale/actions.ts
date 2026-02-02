'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export async function registerReelsOrder(formData: FormData) {
  const name = formData.get('name') as string
  const whatsapp = formData.get('whatsapp') as string
  const email = (formData.get('email') as string) || ''
  
  const rawSkuId = formData.get('skuId')
  const skuId = rawSkuId ? parseInt(rawSkuId as string) : 0
  
  const rawVariationId = formData.get('variationId')
  const variationId = rawVariationId ? parseInt(rawVariationId as string) : 0
  
  const skuSnapshot = formData.get('skuSnapshot') as string
  const variationSnapshot = formData.get('variationSnapshot') as string
  
  const rawPrice = formData.get('price')
  const price = rawPrice ? parseFloat(rawPrice as string) : 0

  // Optional: Add server-side validation here
  if (!name || !whatsapp || !skuId) {
    return { error: 'Missing required fields' }
  }

  // Use the admin client if RLS policies restrict creation, 
  // but here we likely rely on the RPC function to handle logic. 
  // IMPORTANT: Ensure the RPC is accessible to the role used by this client (anon or service_role).
  // Assuming 'create_reels_order_with_quota' is accessible to anon/authenticated.
  
  const { data, error } = await supabase.rpc('create_reels_order_with_quota', {
    p_customer_name: name,
    p_whatsapp: whatsapp,
    p_email: email,
    p_sku_id: skuId,
    p_variation_id: variationId,
    p_sku_snapshot: skuSnapshot,
    p_variation_snapshot: variationSnapshot,
    p_price: price
  })

  if (error) {
    console.error('Error creating order:', error)
    return { error: error.message || 'Error occurred while creating order' }
  }

  // The RPC returns { "order_id": "...", "status": "confirmed" | "waitlist" }
  if (data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderData = data as any
    const { order_id, status } = orderData

    if (status === 'confirmed') {
      redirect(`/pay/${order_id}`)
    } else if (status === 'waitlist') {
      redirect(`/reels/status/${order_id}`)
    } else {
       // Should not happen if status is well typed in DB, but good fallback
       // Maybe just success without redirect? The prompt says Case A and Case B.
       // We can return the status to client if needed, but let's assume we handle it here or error.
       return { error: `Received unknown order status: ${status}` }
    }
  } else {
      return { error: 'No data returned from server' }
  }
}
