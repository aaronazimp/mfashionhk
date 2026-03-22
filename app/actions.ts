'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function submitPaymentProof(orderId: string, proofUrl: string, paymentMethod?: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return { error: 'Server configuration error' }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Determine whether `orderId` is a UUID, a transaction ID, or an order number string.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
    const isTxn = orderId.startsWith('TXN-')
    const matchColumn = isUuid ? 'id' : (isTxn ? 'transaction_id' : 'order_number')

    const pm = paymentMethod ?? 'uploaded_proof'

    const { error } = await supabase
      .from('reels_orders')
      .update({
        status: 'paid',
        payment_proof_url: proofUrl,
        payment_method: pm,
        paid_at: new Date().toISOString()
      })
      .eq(matchColumn, orderId)
      

    if (error) {
      console.error('Database update failed:', error)
      const msg = (error && (error.message || (error as any).details)) ? (error.message || (error as any).details) : 'Failed to update order status'
      return { error: msg }
    }

    revalidatePath(`/pay/${orderId}`)
    return { success: true }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { error: 'An unexpected error occurred' }
  }
}
