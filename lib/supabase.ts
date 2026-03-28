import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Wrap the client's `rpc` method to broadcast responses for debugging.
// This is a no-op on the server.
if (typeof window !== 'undefined') {
	try {
		const originalRpc = (supabase as any).rpc?.bind(supabase)

		if (originalRpc) {
			;(supabase as any).rpc = async (fn: string, params?: any) => {
				const res = await originalRpc(fn, params)
				try {
					const entry = { name: fn, params, result: res, ts: Date.now() }
					;(window as any).__RPC_DEBUG__ = (window as any).__RPC_DEBUG__ || []
					;(window as any).__RPC_DEBUG__.push(entry)
					window.dispatchEvent(new CustomEvent('rpc-debug', { detail: entry }))
				} catch (e) {
					// ignore debug emission errors
				}
				return res
			}
		}
	} catch (e) {
		// ignore wrapping errors in odd runtimes
	}
}
