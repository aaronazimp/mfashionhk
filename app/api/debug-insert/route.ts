import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = {
      customer_name: body.customer_name || 'API Test',
      // add minimal fields; adjust as your table requires
      created_at: new Date().toISOString(),
      note: body.note || 'debug insert',
    }

    const { data, error } = await supabase.from('reels_orders').insert([payload]).select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
