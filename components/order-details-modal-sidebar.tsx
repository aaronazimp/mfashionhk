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
  p_priority_status?: string | null
}

export default function OrderDetailsModal({ open, onOpenChange, customerId, p_priority_status }: Props) {
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<RpcResponse | null>(null)

  useEffect(() => {
    if (!open) return
    if (!customerId) return

    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const rpcArgs: Record<string, any> = { p_customer_id: customerId }
        if (typeof p_priority_status !== 'undefined') rpcArgs.p_priority_status = p_priority_status ?? null
        const data = await getCustomerActiveOrders(customerId as string, p_priority_status ?? null)
        let resp: any = data
        // Handle common Supabase RPC shapes:
        // - Array-wrapped objects: [ { customer_info, orders_by_status } ]
        // - RPC wrapper: { get_customer_active_orders: { ... } }
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0]
          if (first && first.get_customer_active_orders) resp = first.get_customer_active_orders
          else if (first && first.customer_info && first.orders_by_status) resp = first
          else resp = first
        } else if ((data as any).get_customer_active_orders) {
          resp = (data as any).get_customer_active_orders
        }

        if (!mounted) return

        // If RPC returned `action_blocks` (newer shape) normalize to RpcResponse/flat orders
        if (resp && Array.isArray(resp.action_blocks) && resp.action_blocks.length > 0) {
          try {
            const blocks: any[] = resp.action_blocks || []
            const orders: any[] = []
            for (const block of blocks) {
              if (Array.isArray(block.orders) && block.orders.length > 0) {
                for (const ord of block.orders) {
                  const items = (ord.items || []).map((it: any) => ({
                    price: it.price,
                    status: it.status,
                    item_id: it.line_item_id,
                    line_item_id: it.line_item_id,
                    sku_id: it.sku_id,
                    variation_id: it.variation_id,
                    remark: it.remark,
                    quantity: it.quantity,
                    sku_code: it.sku_code,
                    thumbnail: it.main_image,
                    variation: it.variation_text,
                  }))

                  const order_total = Number(ord.order_total ?? block.block_total) || items.reduce((s: number, it: any) => s + (Number(it.price) * Number(it.quantity)), 0)
                  const order_total_items = items.reduce((s: number, it: any) => s + Number(it.quantity), 0)
                  const transaction_id = block.group_id
                  const order_status = ord.dominant_status || block.dominant_status || (items[0]?.status)

                  orders.push({
                    order_number: ord.order_number || block.group_id,
                    order_total_amount: order_total,
                    order_total,
                    order_status,
                    transaction_id,
                    order_total_items,
                    items,
                  })
                }
              } else {
                const items = (block.items || []).map((it: any) => ({
                  price: it.price,
                  status: it.status,
                  item_id: it.line_item_id,
                  line_item_id: it.line_item_id,
                  sku_id: it.sku_id,
                  variation_id: it.variation_id,
                  remark: it.remark,
                  quantity: it.quantity,
                  sku_code: it.sku_code,
                  thumbnail: it.main_image,
                  variation: it.variation_text,
                }))

                const order_total = Number(block.block_total) || items.reduce((s: number, it: any) => s + (Number(it.price) * Number(it.quantity)), 0)
                const order_total_items = items.reduce((s: number, it: any) => s + Number(it.quantity), 0)
                const transaction_id = block.group_id
                const order_status = block.dominant_status || (items[0]?.status)

                orders.push({
                  order_number: block.group_id,
                  order_total_amount: order_total,
                  order_total,
                  order_status,
                  transaction_id,
                  order_total_items,
                  items,
                })
              }
            }

            const statusPriority = Array.from(new Set(blocks.map((b: any) => b.dominant_status).filter(Boolean)))

            const blocksTotal = (blocks || []).reduce((s: number, b: any) => s + (Number(b?.block_total ?? 0) || 0), 0)
            const normalized: RpcResponse = {
              orders,
              // Keep `customer_info` for components that expect it
              customer_info: resp.customer_info,
              whatsapp: resp.customer_info?.phone,
              customer_name: resp.customer_info?.customer_name,
              // Prefer server summary total if present, otherwise fall back to summed block totals
              grand_total_items: resp.summary?.total_active_items,
              grand_total_amount: (resp.summary?.total_active_price || blocksTotal),
              total_orders_count: resp.summary?.total_action_blocks,
              // Preserve raw action_blocks so callers can access group_id/block_total
              action_blocks: resp.action_blocks,
              summary: resp.summary,
              status_priority: statusPriority,
            }

            try {
              console.debug('[getCustomerActiveOrders] normalized preview:', normalized)
            } catch (e) {}

            setPayload(normalized)
            // finished normalization; skip the later setPayload(resp)
            if (mounted) setLoading(false)
            return
          } catch (e) {
            console.error('error normalizing action_blocks', e)
          }
        }

        // log the RPC unwrap and a quick derived-orders preview for debugging
        try {
          console.debug('[getCustomerActiveOrders] resp sample:', resp)
          const preview = (resp && resp.orders_by_status)
            ? Object.entries(resp.orders_by_status || {}).flatMap(([status, bucket]: [string, any]) => {
                const orders = (bucket as any)?.orders || []
                return orders.map((o: any) => ({
                  order_number: o.order_number,
                  order_total: o.order_total ?? o.order_total_amount ?? 0,
                  order_status: o.order_status ?? o.status ?? status,
                  items: (o.items || []).length,
                }))
              })
            : []
          console.debug('[getCustomerActiveOrders] derivedPreview:', preview)
        } catch (e) {
          // ignore debug errors
        }

        setPayload(resp as RpcResponse)
      } catch (err) {
        console.error('get_customer_active_orders rpc error', err)
        setPayload(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [open, customerId, p_priority_status])

  // Derive a flat `Order[]` and summary numbers from the typed `ActiveCustomerRecords` payload
  let derivedOrders: Order[] = []
  if (payload) {
    // Support multiple RPC shapes:
    // - payload.orders: flat array of orders (normalized elsewhere)
    // - payload.orders_by_status: Record<string, { orders: Order[] }>
    // - payload.orders_by_status: Record<string, Order[]> (legacy)
    const flatFromOrders = (payload as any).orders
    if (Array.isArray(flatFromOrders) && flatFromOrders.length > 0) {
      derivedOrders = flatFromOrders as Order[]
    } else {
      derivedOrders = Object.entries(payload.orders_by_status || {}).flatMap(([bucketKey, bucket]: [string, any]) => {
        const orders = Array.isArray(bucket) ? bucket : (bucket?.orders || [])
        return (orders || []).map((o: any) => ({
          order_number: o.order_number,
          order_total_amount: o.order_total ?? o.order_total_amount ?? 0,
          order_total: o.order_total ?? o.order_total_amount ?? 0,
          order_total_items: (o.items || []).reduce((s: number, it: any) => s + (it.quantity ?? 0), 0),
          order_status: o.order_status ?? o.status ?? bucketKey,
          items: (o.items || []).map((it: any) => ({
            price: it.price,
            status: it.status ?? o.order_status ?? o.status ?? bucketKey,
            item_id: it.line_item_id ?? it.item_id,
            remark: it.remark ?? it.remarks ?? null,
            quantity: it.quantity,
            sku_code: it.sku_code,
            thumbnail: it.main_image ?? it.thumbnail,
            main_image: it.main_image,
            variation: it.variation_text ?? it.variation,
            variation_text: it.variation_text,
          })),
        }))
      })
    }
  }

  const grand_total_amount = (payload && (payload as any).grand_total_amount != null)
    ? (payload as any).grand_total_amount
    : derivedOrders.reduce((s, o) => s + (o.order_total_amount ?? o.order_total ?? 0), 0)
  // Prefer action_blocks[].block_total when present (newer RPC shape)
  const actionBlockTotals: number[] = (payload?.action_blocks || []).map((b: any) => Number(b?.block_total ?? 0) || 0)
  const actionBlocksTotal = actionBlockTotals.reduce((s, v) => s + v, 0)
  const displayedTotal = actionBlocksTotal > 0 ? actionBlocksTotal : grand_total_amount
  const grand_total_items = derivedOrders.reduce((s, o) => s + (o.order_total_items ?? 0), 0)
  const total_orders_count = derivedOrders.length
  const waitlistTotal = derivedOrders
    .filter((o) => {
      const st = String(o.order_status || '').toLowerCase().trim()
      return st === 'waitlist' || st === 'pending'
    })
    .reduce((s, o) => s + (o.order_total ?? o.order_total_amount ?? 0), 0)


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

  // Show all derived orders (remove client-side waitlist-only filter)
  const allOrders = derivedOrders

  // Derive a comma-joined transaction string from action_blocks.group_id
  const transactionIds = Array.from(new Set((payload?.action_blocks || []).map((b: any) => b?.group_id).filter(Boolean)))
  const transactionText = transactionIds.length > 0 ? transactionIds.join(', ') : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" p-0 gap-0 w-full max-w-[90vw] flex flex-col overflow-auto">
        <DialogTitle className="text-xs text-center font-semibold px-4 py-3">訂單明細</DialogTitle>

        <div className="bg-white z-10 border-b border-gray-100 px-4 py-4 relative">
          <div className="flex flex-col items-start gap-1">
            {transactionText ? (
              <div className="text-xs text-black font-bold">交易號碼: {transactionText}</div>
            ) : null}
            <div className="min-w-0">
              <div className="text-xs font-bold">顧客: {payload?.customer_info?.customer_name ?? '—'}</div>
            </div>
            <div className="text-xs text-gray-700">聯絡電話: {payload?.customer_info?.phone ?? '—'}</div>
          </div>
          {/* debug panel removed */}
          <div className="mt-3 flex items-start justify-between gap-4 w-full">
            <div className="text-xs">總額: ${displayedTotal ?? 0}</div>
          </div>
        </div>

        <div className="border-t" />

        <div className="flex-1 overflow-y-auto bg-white p-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner className="h-8 w-8 text-[#A87C73]" />
            </div>
          ) : !payload || derivedOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
          ) : (
            <div className="space-y-3">
              {allOrders.map((o) => (
                  <OrderCard key={o.order_number} order={o as any} statusBadge={(s) => <OrderStatusBadge status={s as string} />} />
                ))}
            </div>
          )}
        </div>

        
      </DialogContent>
    </Dialog>
  )
}
