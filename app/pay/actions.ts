'use server'

import { createClient } from '@supabase/supabase-js'

export async function uploadInvoiceAndSave(formData: FormData) {
  const file = formData.get('file') as File
  const fileName = formData.get('fileName') as string
  const orderId = formData.get('orderId') as string

  if (!file || !fileName || !orderId) {
    return { error: 'Missing required fields' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // If Service Key is missing in Dev/Preview, return a mock success to allow flow to continue
  if (!supabaseServiceKey && process.env.NODE_ENV !== 'production') {
     console.warn("Missing SUPABASE_SERVICE_ROLE_KEY. Returning mock receipt URL for development.");
     return { 
         publicUrl: "https://placehold.co/600x800/png?text=Mock+Invoice",
         warning: "Dev Mode: Mock Invoice Used"
     }
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for server-side upload')
    return { error: 'Server configuration error: Missing Service Key' }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 1. Upload File
    const { error: uploadError } = await supabase.storage
      .from('reels_invoices')
      .upload(fileName, buffer, {
        upsert: true,
        contentType: 'image/png'
      })

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError)
      return { error: `Upload failed: ${uploadError.message}` }
    }

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('reels_invoices')
      .getPublicUrl(fileName)

    // 3. Update Order Record
    const { error: dbError } = await supabase
      .from('reels_orders')
      .update({ receipt_url: publicUrl })
      .eq('id', orderId)

    if (dbError) {
      console.error('Database Update Error:', dbError)
      // We don't fail the whole request if only DB update fails, but we should probably warn
      // However, for the UI to be consistent, we return the URL anyway so the client can show it.
      return { publicUrl, warning: 'Database update failed' }
    }

    return { publicUrl }
  } catch (err) {
    console.error('Unexpected error in uploadInvoiceAndSave:', err)
    return { error: 'Internal server error' }
  }
}
