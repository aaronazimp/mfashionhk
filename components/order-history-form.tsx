"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OrderHistoryForm() {
  const [whatsapp, setWhatsapp] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = whatsapp.trim()
    const t = transactionId.trim()
    // require both fields
    if (!w || !t) {
      setError('請同時輸入 WhatsApp 與 交易編號')
      return
    }

    // validate whatsapp is exactly 8 digits
    if (!/^\d{8}$/.test(w)) {
      setError('WhatsApp 必須為 8 位數字')
      return
    }

    setError('')
    const params = new URLSearchParams()
    params.set('whatsapp', w)
    params.set('transaction_id', t)

    router.push(`/order-history?${params.toString()}`)
  }

  return (
    <div className="p-6">
      <h1 className="text-md font-semibold">查找您的訂單</h1>
      <form onSubmit={handleSubmit} className="mt-4 max-w-sm">
        <label className="block text-xs font-medium">WhatsApp 號碼</label>
        <input
          className="text-xs mt-1 block w-full rounded border px-3 py-2"
          value={whatsapp}
          onChange={(e) => { setWhatsapp(e.target.value); if (error) setError('') }}
          inputMode="numeric"
          aria-label="WhatsApp 號碼"
        />
        <label className="block text-xs font-medium mt-3">交易編號</label>
        <input
          className="text-xs mt-1 block w-full rounded border px-3 py-2"
          value={transactionId}
          onChange={(e) => { setTransactionId(e.target.value); if (error) setError('') }}
          aria-label="交易編號"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="mt-3">
          <button className="text-xs px-2 py-2 bg-primary text-white rounded" type="submit">查找訂單</button>
        </div>
      </form>
    </div>
  )
}
