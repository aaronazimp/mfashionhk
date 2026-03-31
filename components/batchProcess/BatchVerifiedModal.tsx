"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import { fetchBulkCustomerOrders, revertAllocatedToConfirmed, reverseConfirmedOrder, bulkVerifyPayments } from "../../lib/orderService"
import type { ActiveCustomerRecords } from '@/types/order'
import { useEffect, useMemo, useState } from "react"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  selectedOrderKeys?: string[]
  onConfirm?: (selected: string[]) => void
  customerIds?: string[]
  statusFilter?: string
}

export default function BatchConfirmModal({
  open,
  onOpenChange,
  selectedOrderKeys = [],
  onConfirm,
  customerIds,
  statusFilter,
}: Props) {
  // (removed WhatsApp transaction extraction helper)
  console.log('BatchConfirmModal render', { open, selectedOrderKeys, customerIds, statusFilter, onConfirmType: typeof onConfirm })
  const [bulkData, setBulkData] = useState<ActiveCustomerRecords[]>([])
  const [loading, setLoading] = useState(false)
  // Snapshot of customerIds captured when modal opens. While modal is open we
  // use this snapshot so parent changes don't force refetch/unmount flicker.
  const [activeCustomerIds, setActiveCustomerIds] = useState<string[] | null>(null)
  const prevBulkDataRef = React.useRef<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)

  // Capture snapshot when modal opens
  useEffect(() => {
    if (open) {
      setActiveCustomerIds(customerIds ? [...customerIds] : [])
      // clear previous fetch snapshot so identical RPC responses
      // are applied when reopening the modal
      prevBulkDataRef.current = null
    } else {
      setActiveCustomerIds(null)
      setBulkData([])
      setCurrentIndex(0)
      // clear previous snapshot when closing to avoid stale cache
      prevBulkDataRef.current = null
    }
  }, [open, customerIds?.join?.(',')])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!open) return

      const ids = activeCustomerIds ?? []
      if (!ids || ids.length === 0) return

      setLoading(true)
      try {
        const data = await fetchBulkCustomerOrders(ids, statusFilter)
        console.log("BatchConfirmModal: fetched bulk orders", { ids, len: Array.isArray(data) ? data.length : 0 })
        const serialized = JSON.stringify(data || [])
        if (mounted) {
          if (prevBulkDataRef.current !== serialized) {
            prevBulkDataRef.current = serialized
            setBulkData(data)
            console.log('BatchConfirmModal: bulkData updated')
          } else {
            console.log('BatchConfirmModal: fetched data identical, not updating state')
          }
        }
      } catch (e) {
        console.error("Failed to fetch bulk orders", e)
        console.log("fetchBulkCustomerOrders RPC error:", e)
        if (mounted) setBulkData([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [open, statusFilter, activeCustomerIds?.join?.(',')])

  useEffect(() => {
    setCurrentIndex((ci) => (bulkData.length === 0 ? 0 : Math.min(ci, bulkData.length - 1)))
  }, [bulkData])

  // (removed automatic extraction of transaction ids from bulkData)

  const extractedOrderGroups = useMemo(() => {
    // Show orders for the selected customer only. RPC `orders_by_status` maps status -> { orders: OrderGroup[], status_total?: number }
    const b = bulkData[currentIndex]
    const groups = b
      ? Object.values(b.orders_by_status).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
      : []

    return groups.map((og: any) => ({
      order_number: og.order_number,
      order_total: og.order_total,
      // include order-level receipt/proof and identifiers from RPC (no fallbacks)
      payment_proof_url: og.payment_proof_url,
      transaction_id: og.transaction_id,
      status: og.status,
      items: (og.items || []).map((it: any) => ({
        item_id: it.line_item_id,
        price: it.price,
        status: it.status,
        quantity: it.quantity,
        sku_code: it.sku_code,
        sku: it.sku,
        thumbnail: it.main_image,
        imageUrl: it.main_image,
        payment_proof_url: it.payment_proof_url,
        receipt_url: it.receipt_url,
        transaction_id: it.transaction_id,
        // preserve waitlist/preorder flag from RPC so child components can
        // display a '預購' badge when appropriate
        is_waitlist_item: it.is_waitlist_item,
        variation: it.variation_text,
        remarks: it.remark,
        payment_deadline: it.payment_deadline,
      })),
    }))
  }, [bulkData, currentIndex])

  const totalAmount = useMemo(() => {
    return extractedOrderGroups.reduce((sum: number, og: any) => {
      const v = Number(og.order_total ?? og.order_total_amount ?? 0) || 0
      return sum + v
    }, 0)
  }, [extractedOrderGroups])
  const totalQuantity = useMemo(() => {
    return extractedOrderGroups.reduce((sum: number, og: any) => {
      const itemsQty = (og.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
      return sum + itemsQty
    }, 0)
  }, [extractedOrderGroups])
  
  
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
  const [ordersExpanded, setOrdersExpanded] = useState<boolean>(true)
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false)
  

  // (removed WhatsApp message composition and send/resend functions)

  async function handleRevert() {
    // kept for backward-compat; prefer using reverseConfirmedOrder via dialog choices
    if (!currentCustomerId) return
    try {
      await revertAllocatedToConfirmed(currentCustomerId)
    } catch (e) {
      console.error('Failed to revert', e)
    }
  }

  async function handleConfirmTransaction() {
    try {
      console.log('確認交易 clicked', { customerId: currentCustomerId })
      // collect transaction ids from displayed orders
      const txs = extractedOrderGroups.flatMap((og: any) => (og.items || []).map((it: any) => it.transaction_id).filter(Boolean))
      try {
        if (txs.length > 0) {
          setLoading(true)
          await bulkVerifyPayments(txs as string[])
          console.log('bulk verify success', { txCount: txs.length })
        } else {
          console.warn('handleConfirmTransaction: no transaction ids to verify')
        }
      } finally {
        setLoading(false)
      }

      // After successful verification, auto-advance to next customer or show completion dialog
      if (bulkData.length > 1 && currentIndex < bulkData.length - 1) {
        setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))
        // expand orders for next customer by default
        setOrdersExpanded(true)
        return
      }

      // last customer processed — show completion dialog
      setBatchCompleteOpen(true)
    } catch (e) {
      console.error('confirm transaction failed', e)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs h-[100vh]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-[90vw] max-w-[400px] max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col">

        {/* Fixed header area (non-scrollable) */}
        <div className="flex-shrink-0">
          <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
            <div className=" text-xs text-gray-600">核對入數記錄</div>
            <button
              aria-label="close"
              onClick={() => onOpenChange(false)}
              className="text-gray-500 absolute right-4 top-4"
            >
              <Lucide.X />
            </button>
          </div>

          <div className="px-6 pb-4 border-b flex-col items-center">
          <div className="flex items-center gap-2 justify-center">
            {bulkData.length > 1 && (
              <button
                aria-label="previous customer"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={loading}
                className="p-1 text-gray-500 disabled:opacity-40"
              >
                <Lucide.ChevronLeft />
              </button>
            )}

            <div className="text-[10px] text-gray-500">
              {loading
                ? "載入中…"
                : `第 ${bulkData.length > 0 ? currentIndex + 1 : 0}/${bulkData.length} 位顧客`}
            </div>

            {bulkData.length > 1 && (
              <button
                aria-label="next customer"
                onClick={() => setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))}
                disabled={loading}
                className="p-1 text-gray-500 disabled:opacity-40"
              >
                <Lucide.ChevronRight />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3 justify-center">
            <div className="text-xs font-semibold">
              {bulkData[currentIndex]?.customer_info.customer_name ?? "—"}
            </div>
            <div className="text-xs font-semibold text-gray-700">|</div>
            <div className="text-xs font-semibold">{bulkData[currentIndex]?.customer_info.phone ?? "—"}</div>
          </div>
        </div>
        </div>

        {/* Body (scrollable) */}
        <div className="p-6 space-y-4 overflow-auto flex-1">
          {/* Summary row */}
          <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="text-xs">交易編號</div>
                  <div className="text-xs">{(function(){
                    try {
                      const txs = extractedOrderGroups.flatMap((og:any) => (og.items||[]).map((it:any)=>it.transaction_id).filter(Boolean))
                      return txs.length ? txs[0] : '—'
                    } catch(e) {
                      return '—'
                    }
                  })()}</div>
                </div>    
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-gray-700">共 {extractedOrderGroups.length} 張訂單 | {totalQuantity} 件商品</div>
              <div className="text-xs font-semibold">總額 ${totalAmount.toLocaleString()}</div>
            </div>

              <div>
                <div className="text-xs text-gray-500">{/* transaction id placeholder */}</div>
                <div className="mt-2">
                  <button
                    className="px-3 py-1.5 rounded bg-primary text-white text-xs"
                    onClick={handleConfirmTransaction}
                  >
                    確認交易
                  </button>
                </div>
              </div>
          </div>

          {/* Image container (500px height) - show single image (first item) for current customer */}
          <div className="mt-4 w-full h-[400px] bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center p-4">
            {(() => {
              const firstOrder = extractedOrderGroups[0]
              const firstItem = firstOrder?.items?.[0] ?? null
                // Payment proof image is supplied at order level in RPC responses
                const url = firstOrder?.payment_proof_url ?? firstItem?.payment_proof_url
              if (url) {
                return (
                  <a href={url} target="_blank" rel="noreferrer" className="w-full h-full flex items-center justify-center">
                    <img src={url} alt={`receipt-${firstItem?.item_id ?? 'img'}`} className="max-h-[500px] w-auto object-contain" />
                  </a>
                )
              }
              return <div className="text-sm text-gray-400">無收據圖片</div>
            })()}
          </div>

          


          {/* expand/collapse button placed below image container */}
          <div className="flex justify-center mt-2">
            <button
              className="px-2 py-1 rounded text-xs text-gray-700 font-bold flex items-center"
              onClick={() => setOrdersExpanded((s) => !s)}
            >
              <span>{ordersExpanded ? '收起訂單' : '展開訂單'}</span>
              {ordersExpanded ? (
                <Lucide.ChevronUp className="ml-2" size={16} />
              ) : (
                <Lucide.ChevronDown className="ml-2" size={16} />
              )}
            </button>
          </div>

          {/* Orders list (expandable whole section) */}
          {ordersExpanded ? (
            <div className="space-y-3 mt-3">
              {extractedOrderGroups.length === 0 ? (
                <div className="text-xs text-center text-gray-500">{loading ? '載入中…' : '沒有選取任何訂單'}</div>
              ) : (
                extractedOrderGroups.map((og) => (
                  <OrderCard key={og.order_number} order={og} className="bg-white rounded-xl shadow max-h-96 overflow-hidden" />
                ))
              )}
            </div>
          ) : null}

         

          {/* Action row: Next / Complete */}
          <div className="mt-3 flex justify-center">
            {bulkData.length > 1 && currentIndex < bulkData.length - 1 ? (
              <button
                className="px-4 py-2 rounded-lg bg-primary text-sm"
                onClick={() => setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))}
                disabled={loading || currentIndex >= bulkData.length - 1}
              >
                下一位顧客
              </button>
            ) : null}
          </div>

          {/* Batch complete dialog */}
          {batchCompleteOpen ? (
            <div className="fixed inset-0 z-60 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative bg-white rounded-xl shadow-lg p-6 w-[90vw] max-w-[400px] z-70">
                <div className="text-lg font-semibold mb-2">已完成批次處理</div>
                <div className="text-sm text-gray-600 mb-4">您已處理完所有顧客。批次流程已完成。</div>
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 rounded bg-primary text-white"
                    onClick={() => {
                      setBatchCompleteOpen(false)
                      onOpenChange(false)
                    }}
                  >
                    確認
                  </button>
                </div>
              </div>
            </div>
          ) : null}

         
        </div>
      </div>
    </div>
  )
}
