'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function submitPaymentProof(orderId: string, proofUrl: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return { error: 'Server configuration error' }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('reels_orders')
      .update({
        status: 'paid',
        payment_proof_url: proofUrl,
        payment_method: 'uploaded_proof'
      })
      .eq('id', orderId)

    if (error) {
      console.error('Database update failed:', error)
      return { error: 'Failed to update order status' }
    }

    revalidatePath(`/pay/${orderId}`)
    return { success: true }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { error: 'An unexpected error occurred' }
  }
}
