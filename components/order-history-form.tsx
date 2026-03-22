"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OrderHistoryForm() {
  const [whatsapp, setWhatsapp] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!whatsapp) return
    router.push(`/order-history?whatsapp=${encodeURIComponent(whatsapp)}`)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Find Your Orders</h1>
      <form onSubmit={handleSubmit} className="mt-4 max-w-sm">
        <label className="block text-sm font-medium">WhatsApp number</label>
        <input
          className="mt-1 block w-full rounded border px-3 py-2"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="e.g. 85212345678 or 333"
        />
        <div className="mt-3">
          <button className="px-4 py-2 bg-sky-600 text-white rounded" type="submit">Lookup Orders</button>
        </div>
      </form>
    </div>
  )
}
