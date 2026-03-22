"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import OrderCard from './OrderCard'
import { getCustomerActiveOrders } from '@/lib/orderService'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from './OrderCard'
import { Spinner } from '@/components/ui/spinner'
import type { Item, Order, RpcResponse } from '@/types/order'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: string | null
}

export default function OrderDetailsModal({ open, onOpenChange, customerId }: Props) {
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<RpcResponse | null>(null)

  useEffect(() => {
    if (!open) return
    if (!customerId) return

    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getCustomerActiveOrders(customerId as string)
        let resp: any = data
        if (Array.isArray(data) && data.length > 0 && data[0].get_customer_active_orders) resp = data[0].get_customer_active_orders
        else if ((data as any).get_customer_active_orders) resp = (data as any).get_customer_active_orders

        if (!mounted) return

        // Normalize current RPC shape: { orders_by_status: { ... }, customer_info: {...} }
        let finalPayload: RpcResponse | null = null

        if (resp) {
          if (resp.orders_by_status) {
            const buckets: Record<string, any[]> = resp.orders_by_status || {}
            const flatOrders: any[] = Object.entries(buckets).flatMap(([status, arr]) => (arr || []).map((o: any) => ({ ...o, order_status: o.order_status ?? status })))
            const orders: Order[] = flatOrders.map((o: any) => ({
              order_number: o.order_number,
              order_total_amount: o.order_total ?? o.order_total_amount ?? 0,
              order_total: o.order_total ?? o.order_total_amount ?? 0,
              order_total_items: (o.items || []).reduce((s: number, it: any) => s + (it.quantity ?? 0), 0),
              order_status: o.order_status,
              items: (o.items || []).map((it: any) => ({
                price: it.price,
                status: it.status,
                item_id: it.line_item_id ?? it.item_id,
                // normalize both `remark` and `remarks` to be safe
                remark: it.remark ?? it.remarks ?? null,
               
                quantity: it.quantity,
                sku_code: it.sku_code,
                thumbnail: it.main_image ?? it.thumbnail,
                main_image: it.main_image,
                variation: it.variation_text ?? it.variation,
                variation_text: it.variation_text,
              })),
            }))

            const grand_total_amount = orders.reduce((s, o) => s + (o.order_total_amount ?? o.order_total ?? 0), 0)
            const grand_total_items = orders.reduce((s, o) => s + (o.order_total_items ?? 0), 0)
            const total_orders_count = orders.length
            const waitlistTotal = orders
              .filter((o) => {
                const st = String(o.order_status || '').toLowerCase().trim()
                return st === 'waitlist' || st === 'pending'
              })
              .reduce((s, o) => s + (o.order_total ?? o.order_total_amount ?? 0), 0)

            finalPayload = {
              orders,
              customer_name: resp.customer_info?.customer_name ?? resp.customer_name,
              whatsapp: resp.customer_info?.phone ?? resp.whatsapp,
              grand_total_amount,
              grand_total_items,
              total_orders_count,
              order_total: resp.order_total ?? waitlistTotal,
            }
          } else if (resp.action_blocks) {
            const blocks: any[] = resp.action_blocks || []
            const orders: Order[] = blocks.flatMap((blk: any) => (blk.orders || []).map((o: any) => {
              const items = (o.items || []).map((it: any) => ({
                price: it.price,
                status: it.status ?? blk.dominant_status,
                item_id: it.line_item_id ?? it.item_id,
                remark: it.remark ?? it.remarks ?? null,
                quantity: it.quantity,
                sku_code: it.sku_code ?? it.sku_id,
                thumbnail: it.main_image ?? it.thumbnail,
                main_image: it.main_image,
                variation: it.variation_text ?? it.variation,
                variation_text: it.variation_text,
              }))

              return {
                order_number: o.order_number ?? blk.group_id,
                order_total_amount: o.order_total ?? o.order_total_amount ?? blk.block_total ?? 0,
                order_total: o.order_total ?? o.order_total_amount ?? blk.block_total ?? 0,
                order_total_items: items.reduce((s: number, it: any) => s + (it.quantity ?? 0), 0),
                order_status: o.order_status ?? blk.dominant_status ?? (items[0]?.status ?? undefined),
                items,
              }
            }))

            const grand_total_amount = resp.summary?.total_active_price ?? orders.reduce((s, o) => s + (o.order_total_amount ?? o.order_total ?? 0), 0)
            const grand_total_items = resp.summary?.total_active_items ?? orders.reduce((s, o) => s + (o.order_total_items ?? 0), 0)
            const total_orders_count = orders.length

            finalPayload = {
              orders,
              customer_name: resp.customer_info?.customer_name ?? resp.customer_name,
              whatsapp: resp.customer_info?.phone ?? resp.whatsapp,
              grand_total_amount,
              grand_total_items,
              total_orders_count,
              order_total: resp.summary?.total_active_price ?? orders.reduce((s, o) => s + (o.order_total_amount ?? o.order_total ?? 0), 0),
            }
          } else {
            finalPayload = resp as RpcResponse
          }
        }

        // Normalize item remark shape across RPC outputs: accept both `remarks` and `remark`
        if (finalPayload && finalPayload.orders) {
          finalPayload.orders = (finalPayload.orders || []).map((ord: any) => ({
            ...ord,
            items: (ord.items || []).map((it: any) => ({
              ...it,
              remark: it.remark ?? it.remarks ?? null,
              remarks: it.remark ?? it.remarks ?? null,
            })),
          }))
        }

        setPayload(finalPayload)
      } catch (err) {
        console.error('get_customer_active_orders rpc error', err)
        setPayload(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [open, customerId])

  // Status badge rendering delegated to shared `OrderStatusBadge`

  const getStatusLabel = (status?: string) => {
    const s = String(status || '').toLowerCase().trim()
    const labels: Record<string, string> = {
      waitlist: '候補中',
      pending: '候補中',
      confirmed: '待付款',
      paid: '待寄貨',
      verified: '已核數',
      completed: '已完成',
      void: '已取消',
      'out-of-stock': '缺貨',
    }
    return labels[s] ?? status ?? ''
  }

  const isWaitlist = (status?: string) => {
    const s = String(status || '').toLowerCase().trim()
    return s === 'waitlist' || s === 'pending'
  }

  const statusSummaryText = (() => {
    if (!payload || !payload.orders || payload.orders.length === 0) return null
    const counts: Record<string, number> = {}
    // Count only non-waitlist orders for the summary
    payload.orders.forEach((o) => {
      if (isWaitlist(o.order_status)) return
      const lbl = getStatusLabel(o.order_status)
      if (!lbl) return
      counts[lbl] = (counts[lbl] || 0) + 1
    })
    const parts = Object.entries(counts).map(([lbl, cnt]) => `還有 ${cnt}張${lbl}訂單需要處理`)
    return parts.length > 0 ? parts.join('  ') : null
  })()

  const waitlistOrders = (payload?.orders || []).filter((o) => isWaitlist(o.order_status))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" p-0 gap-0 w-full max-w-[90vw] flex flex-col overflow-hidden">
        <DialogTitle className="text-sm text-center font-semibold px-4 py-3">訂單明細</DialogTitle>

        <div className="bg-white z-10 border-b border-gray-100 px-4 py-4 relative">
          <div className="flex flex-col items-start gap-1">
            <div className="min-w-0">
              <div className="text-lg font-bold">顧客: {payload?.customer_name ?? '—'}</div>
            </div>
            <div className="text-sm text-gray-700">聯絡電話: {payload?.whatsapp ?? '—'}</div>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4 w-full">
            <div className="text-xs font-medium flex-1 ">{statusSummaryText}</div>
            <div className="font-semibold ml-4">總額: ${payload?.grand_total_amount ?? 0}</div>
          </div>
        </div>

        <div className="border-t" />

        <div className="flex-1 overflow-y-auto bg-white p-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner className="h-8 w-8 text-[#A87C73]" />
            </div>
          ) : !payload || !payload.orders || payload.orders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
          ) : (
            <div className="space-y-3">
              {waitlistOrders.map((o) => (
                  <OrderCard key={o.order_number} order={o as any} statusBadge={(s) => <OrderStatusBadge status={s as string} />} />
                ))}
            </div>
          )}
        </div>

        
      </DialogContent>
    </Dialog>
  )
}
