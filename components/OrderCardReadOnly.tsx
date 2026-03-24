"use client"

import React, { useEffect, useState } from 'react'
import * as Lucide from 'lucide-react'
import Image from 'next/image'

import type { OCItem, OCOrder } from '@/types/order'
import { OrderStatusLabel, OrderStatusStyleMap } from '@/lib/orderStatus'

export function getOrderStatusLabel(status?: string | null) {
  const s = String(status || '').toLowerCase().trim()
  return OrderStatusLabel[s] ?? OrderStatusLabel[s.replace(/[-_]/g, '')] ?? status ?? ''
}

export function OrderStatusBadge({ status, className = '' }: { status?: string | null; className?: string }) {
  const s = String(status || '').toLowerCase().trim()
  const label = getOrderStatusLabel(status)

  const exact = OrderStatusStyleMap[s]
  const normalized = OrderStatusStyleMap[s.replace(/[-_]/g, '')]
  const chosen = exact ?? normalized

  const badgeBase = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0'

  if (chosen) return <span className={`${badgeBase} ${chosen} ${className}`}>{label}</span>

  return <span className={`${badgeBase} text-gray-500 border-gray-200 bg-white ${className}`}>{label}</span>
}

type Props = {
  order: OCOrder
  className?: string
  compact?: boolean
  statusBadge?: (status?: string) => React.ReactNode
  onItemStatusChange?: (itemId: string, newStatus: string, meta?: { source?: string }) => void
  hideHeader?: boolean
}

export default function OrderCard({ order, className = '', compact = false, statusBadge, onItemStatusChange, hideHeader = false }: Props) {
  const [items, setItems] = useState<OCItem[]>(order.items || [])

  useEffect(() => {
    setItems(order.items || [])
  }, [order.items])
  // swipe/overlay logic removed

  const hasShippedUI = (items || []).some((it) => {
    const s = String(it.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
    return s === 'shipped'
  })

  return (
    <div className={`w-[325px] relative rounded-2xl overflow-hidden shadow-sm ${className}`}>
      {hasShippedUI ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          {/* backdrop covers the entire card */}
          <div className="absolute inset-0 bg-gray-800/60 rounded-lg pointer-events-none" />
          {/* centered badge scales with screen size but the backdrop covers full card */}
          <div className="relative z-50 w-full h-full flex items-center justify-center pointer-events-none px-4 py-6">
            <div className="w-full max-w-3xl">
              <div className="text-white rounded-xl px-6 py-4 text-center text-lg sm:text-2xl md:text-3xl font-extrabold tracking-wider mx-auto flex flex-col items-center justify-center gap-3">
                <Lucide.Truck className="w-8 h-8" />
                <span>已寄出</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {!hideHeader && order.order_number ? <div className="bg-primary text-center text-xs text-white py-2">訂單# {order.order_number}</div> : null}
      <div className="bg-white p-4 space-y-4 border-t border-gray-100 max-h-96 overflow-y-auto">
          {(items || []).map((it, idx) => {
          const isLast = idx === (items || []).length - 1
          const isCanceled = String(it.status || '').toLowerCase().trim() === 'void' || String(it.status || '').toLowerCase().trim() === 'cancelled'
          

          const _normStatus = String(it.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
          const isPrePendingToShip = _normStatus === 'prependingtoship'
          const isShipped = _normStatus === 'shipped'

          const priceNum = Number((it as any).price ?? NaN)
          const qtyNum = Number((it as any).quantity ?? 1)
          const total = Number.isFinite(priceNum) ? priceNum * (Number.isFinite(qtyNum) ? qtyNum : 1) : null
          const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
          
          return (
            <div key={it.item_id ?? idx} className={isCanceled ? 'relative opacity-40' : 'relative'}>
              <div className="relative">
               

                {/* overlays removed */}

               
                

                <div>
                  <div className="flex items-center gap-4">
                    {/* Thumbnail column */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {(() => {
                        const imgSrc = (it as any).thumbnail ?? (it as any).imageUrl ?? (it as any).image_url ?? (it as any).image ?? ''
                        if (imgSrc) {
                          return <Image src={imgSrc} alt={String(it.sku_code ?? it.sku ?? '')} width={64} height={64} className="object-cover w-full h-full" />
                        }
                        return <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">無圖</div>
                      })()}
                    </div>
                    <div className="flex-1 min-w-0 ">
                      <div className="text-sm font-semibold text-gray-900 ">{it.sku_code ?? it.sku}</div>
                        <div className={`flex flex-col items-start gap-1`}>
                        <div className="flex items-start gap-2 text-xs">
                          <div className="">{it.variation}</div>
                          {it.quantity != null ? <div className="text-gray-400">x{it.quantity}</div> : null}
                        </div>
                        {(() => {
                          const remark = (it as any).remark ?? (it as any).remarks
                          return remark ? <div className=" text-gray-400 mt-1 text-[9px] ">{remark}</div> : null
                        })()}
                      </div>
                    </div>

                    {/* Status badge & price column (right-aligned) */}
                    <div className="flex flex-col items-end justify-center gap-1">
                      <div className="flex-shrink-0">{statusBadge ? statusBadge(it.status) : <OrderStatusBadge status={it.status} />}</div>
                      <div className="text-sm font-bold text-gray-900 pt-2 pr-2 mt-2">{total != null ? `$${fmt(total)}` : `$${it.price ?? '—'}`}</div>
                    </div>
                  </div>
                </div>
              </div>
              {!isLast && <div className="border-t border-gray-100 mt-3" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
