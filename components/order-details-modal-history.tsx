"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import OrderCard from './OrderCard'
import { getSingleOrderDetails } from '@/lib/orderService'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { OrderStatusBadge } from './OrderCard'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import type { Order, SingleOrderDetailsResponse } from '@/types/order'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: string | null
  referenceId?: string | null
}

export default function OrderDetailsModal({ open, onOpenChange, customerId, referenceId }: Props) {
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<SingleOrderDetailsResponse | null>(null)
  const [statusPriority, setStatusPriority] = useState<string[] | undefined>(undefined)
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()


  useEffect(() => {
    if (!open) return
    if (!customerId) return

    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const p_customer_id = customerId as string
        const p_reference_id = referenceId ?? ''
        const resp: any = await getSingleOrderDetails(p_customer_id, p_reference_id)
        if (!mounted) return

        // RPC may return either `orders` (SingleOrderDetailsResponse) or `action_blocks` (grouped)
        if (Array.isArray(resp?.orders) && resp.orders.length > 0) {
          setStatusPriority((resp as any).status_priority ?? undefined)

          // Normalize item fields so UI components (e.g., OrderCard) can
          // rely on `thumbnail` / `variation` properties regardless of RPC shape.
          try {
            const normalizedOrders = (resp.orders || []).map((o: any) => ({
              ...o,
              items: (o.items || []).map((it: any) => ({
                ...it,
                thumbnail: it.thumbnail ?? it.main_image ?? it.imageUrl ?? it.image_url ?? null,
                variation: it.variation ?? it.variation_text ?? null,
              })),
            }))

            const normalizedResp = { ...(resp || {}), orders: normalizedOrders }
            setPayload(normalizedResp as SingleOrderDetailsResponse)
          } catch (e) {
            setPayload(resp as SingleOrderDetailsResponse)
          }
        } else {
          const blocks: any[] = resp?.action_blocks || []

          // Map each action_block -> one or more UI order cards representing the group
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
                  shipment_id: ord.shipment_id ?? block.shipment_id ?? undefined,
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
                shipment_id: block.shipment_id ?? undefined,
                order_total_items,
                items,
              })
            }
          }

          const statusPriority = Array.from(new Set(blocks.map((b: any) => b.dominant_status).filter(Boolean)))

          const normalized: SingleOrderDetailsResponse = {
            orders,
            summary: resp.summary,
            reference_id: resp.reference_id,
            customer_info: resp.customer_info,
          }

          setStatusPriority(statusPriority)
          setPayload(normalized)
        }
      } catch (err) {
        console.error('get_single_order_details rpc error', err)
        setPayload(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [open, customerId])

  useEffect(() => {
    // reset index when payload changes
    setCurrentIndex(0)
  }, [payload?.orders])

  // Determine the primary status for a given order by looking at item-level statuses
  const getPrimaryStatusFromOrder = (order?: Order | null) => {
    if (!order || !order.items) return undefined
    const priority = statusPriority
    if (!Array.isArray(priority) || priority.length === 0) return order.order_status
    for (const p of priority) {
      for (const it of order.items || []) {
        const s = String(it.status).toLowerCase().trim()
        if (s === p) return p
      }
    }
    return order.order_status
  }

  const pages = useMemo(() => {
    const orders = payload?.orders || []
    const map = new Map<string, any[]>()
    for (const o of orders) {
      const st = String(getPrimaryStatusFromOrder(o as any) ?? (o as any).order_status ?? 'unknown')
      if (!map.has(st)) map.set(st, [])
      map.get(st)!.push(o)
    }

    // Build groups array; if `status_priority` is provided prefer that ordering
    const defaultGroups: { status: string; orders: any[] }[] = Array.from(map.entries()).map(([status, orders]) => ({ status, orders }))
    const priority = statusPriority
    if (!priority || priority.length === 0) return defaultGroups
    const ordered: { status: string; orders: any[] }[] = []
    const seen = new Set<string>()
    for (const p of priority) {
      if (map.has(p)) {
        ordered.push({ status: p, orders: map.get(p)! })
        seen.add(p)
      }
    }
    // append remaining statuses not in priority
    for (const g of defaultGroups) {
      if (!seen.has(g.status)) ordered.push(g)
    }
    return ordered
  }, [payload?.orders, statusPriority])

  const prevOrder = () => setCurrentIndex((i) => Math.max(0, i - 1))
  const nextOrder = () => setCurrentIndex((i) => {
    const max = (pages?.length) - 1
    return Math.min(max, i + 1)
  })



  // Status badge will be rendered by the shared `OrderStatusBadge` component

  const getStatusLabel = (status?: string) => {
    const s = String(status || '').toLowerCase().trim()
    const labels: Record<string, string> = {
      waitlist: '候補中',
      pending: '候補中',
      allocated: '待通知',
      confirmed: '待付款',
      paid: '待寄貨',
      verified: '待執貨',
      pre_pending_to_ship: '執貨中',
      pending_to_ship: '待寄出',
      shipped: '已寄出',
      completed: '已完成',
      cancelled: '已取消',
      'out-of-stock': '缺貨',
      void: '已取消',
    }
    return labels[s] ?? status ?? ''
  }

  const getPrimaryStatus = (payload?: SingleOrderDetailsResponse | null) => {
    if (!payload || !payload.orders) return undefined
    const priority = statusPriority
    if (!Array.isArray(priority) || priority.length === 0) return undefined
    for (const p of priority) {
      for (const order of payload.orders || []) {
        for (const it of order.items || []) {
          const s = String(it.status || '').toLowerCase().trim()
          if (s === p) return p
        }
      }
    }
    return undefined
  }


  const getPrimaryStatusFromPage = (page?: { status: string; orders: any[] } | null) => {
    if (!page || !page.orders) return undefined
    const priority = statusPriority
    if (!Array.isArray(priority) || priority.length === 0) return undefined
    for (const p of priority) {
      for (const o of page.orders || []) {
        for (const it of o.items || []) {
          const s = String(it.status).toLowerCase().trim()
          if (s === p) return p
        }
      }
    }
    return undefined
  }

  const getActionLabel = (status?: string | undefined) => {
    if (!status) return null
    const s = String(status).toLowerCase().trim()
    const map: Record<string, string> = {
      waitlist: '分配補貨',
      allocated: '發送通知',
      confirmed: '催收付款',
      paid: '核對數紙',
      verified: '打包執貨',
      pre_pending_to_ship: '打包執貨',
      pending_to_ship: '確認寄貨',
      shipped: '已寄出',
      completed: '已完成',
      cancelled: '已取消',
      'out-of-stock': '缺貨',
      void: '已取消',
    }
    return map[s] ?? null
  }

  const navigateForAction = (status?: string | undefined, page?: { status: string; orders: Order[] } | null) => {
    if (!status) return
    const s = String(status).toLowerCase().trim()
    const customer = customerId || payload?.customer_info?.customer_name || ''
    const orderNumbers = (page?.orders || []).map((o) => o.order_number).filter(Boolean).join(',')
    const firstSku = page?.orders?.[0]?.items?.[0]?.sku_id ?? ''

    try {
      // close this modal first so the destination modal (on the admin page)
      // can mount above it without z-index clashes
      try { onOpenChange(false) } catch (e) {}
      const doPush = (url: string) => setTimeout(() => router.push(url), 80)

      switch (s) {
        case 'waitlist':
          doPush(`/admin/orders/restock?sku=${encodeURIComponent(String(firstSku))}&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
          break
        case 'allocated':
          doPush(`/admin/orders?modal=batchConfirm&status=allocated&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
          break
        case 'confirmed':
          doPush(`/admin/orders?modal=batchPaymentReminder&status=confirmed&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
          break
        case 'paid':
          doPush(`/admin/orders?modal=batchVerified&status=paid&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
          break
        case 'verified':
        case 'pending_to_ship':
          doPush(`/admin/orders?modal=batchShipping&status=${encodeURIComponent(s)}&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
          break
        default:
          doPush(`/admin/orders?status=${encodeURIComponent(s)}&customer=${encodeURIComponent(customer)}&orders=${encodeURIComponent(orderNumbers)}`)
      }
    } catch (e) {
      console.error('navigateForAction error', e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" p-0 gap-0 w-full max-w-[90vw] flex flex-col h-[95vh] overflow-hidden">
        <DialogTitle className="text-sm text-center font-semibold px-4 py-3">訂單明細</DialogTitle>
        {/* Header */}
        <div className="bg-white z-10 border-b border-gray-100 px-4 py-4 relative">
          <div className="flex flex-col items-start gap-1">
            <div className="min-w-0">
              <div className="text-sm font-bold mb-2">參考編號: {payload?.reference_id}</div>
              <div className="text-sm font-bold">顧客: {payload?.customer_info?.customer_name}</div>
            </div>
            <div className="text-sm text-gray-700">聯絡電話: {payload?.customer_info?.phone}</div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="text-xs font-medium">共 {payload?.summary?.total_orders} 張訂單</div>
            
          </div>
          
        </div>

        <div className="border-t" />

        <div className="flex-1 overflow-y-auto bg-white p-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner className="h-10 w-10 text-[#A87C73]" />
            </div>
          ) : !payload || !payload.orders || payload.orders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
          ) : (
            <div className="space-y-6 ">
              {(() => {
                    const pagesList = pages
                    const total = pagesList.length
                    if (total === 0) return <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
                    const page = pagesList[currentIndex]
                    return (
                      <div>
                       

                        <div className="rounded-2xl overflow-hidden  mx-auto max-w-4xl">
                          <div className="bg-white rounded-b-2xl p-4 space-y-6 border-t border-gray-100">
                            {(page?.orders || []).map((order) => (
                              <OrderCard key={order.order_number} order={order as any} statusBadge={(s) => <OrderStatusBadge status={s as string} />} />
                            ))}
                          </div>
                        </div>
                        
                      </div>
                    )
                  })()}
            </div>
          )}
        </div>

        

        

        {/* Footer action button */}
        {(() => {
          const page = pages[currentIndex]
          const primary = getPrimaryStatusFromPage(page) ?? getPrimaryStatus(payload)
          const label = getActionLabel(primary)
          if (!label) return null
          return (
            <div className="bg-white border-t p-4">
              <Button
                className="w-full"
                onClick={() => navigateForAction(primary, page)}
                disabled={loading}
              >
                {label}
              </Button>
            </div>
          )
        })()}

        
      </DialogContent>
    </Dialog>
  )
}
