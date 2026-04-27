"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import { fetchBulkCustomerOrders, revertAllocatedToConfirmed, reverseConfirmedOrder, markRestockNotified } from "../../lib/orderService"
import type { BulkCustomerOrderRecord } from '@/types/order'
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
  statusFilter = 'stock_arrived_contact',
}: Props) {
  function extractTransactionId(obj: any): string | null {
    try {
      const seen = new Set<any>()
      const queue: any[] = [obj]
      const keys = ['transaction_id', 'transactionId', 'tx', 'transaction', 'id']
      while (queue.length) {
        const cur = queue.shift()
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
        seen.add(cur)
        for (const k of keys) {
          if (cur[k]) return String(cur[k])
        }
        for (const v of Object.values(cur)) {
          if (v && typeof v === 'object') queue.push(v)
        }
      }
    } catch (e) {
      console.warn('extractTransactionId error', e)
    }
    return null
  }
  console.log('BatchConfirmModal render', { open, selectedOrderKeys, customerIds, statusFilter, onConfirmType: typeof onConfirm })
  const [bulkData, setBulkData] = useState<BulkCustomerOrderRecord[]>([])
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

  // If the fetched bulk data already contains a transaction id, surface
  // it in the modal so the message and button state reflect an existing tx.
  useEffect(() => {
    try {
      const entry = bulkData[currentIndex]
      if (!entry) return
      const txFromBulk = extractTransactionId(entry)
      const custId = entry?.customer_info?.customer_id ?? null
      if (txFromBulk && custId) {
        setLastNotifiedCustomerId(custId)
        setLastNotifiedTransactionId(txFromBulk)
      }
    } catch (e) {
      console.warn('detect tx from bulkData failed', e)
    }
  }, [bulkData, currentIndex])

  // Map RPC `transactions` shape into UI-friendly transaction + order shape
  const transactionsMapped = useMemo(() => {
    const b = bulkData[currentIndex]
    const txs = b?.transactions ?? []

    return (txs as any[]).map((tx) => ({
      transaction_id: tx.transaction_id ?? tx.transaction_group_id ?? null,
      transaction_total: tx.transaction_total ?? tx.transaction_total_amount ?? 0,
      payment_proof_url: tx.payment_proof_url ?? null,
      orders: (tx.orders || []).map((og: any) => ({
        order_number: og.order_number,
        order_total: og.order_total ?? og.order_total_amount ?? 0,
        order_item_count: og.order_item_count ?? (og.items || []).length,
        order_status: og.order_status ?? og.status ?? null,
        items: (og.items || []).map((it: any) => ({
          item_id: it.line_item_id ?? it.item_id ?? `${og.order_number}_${Math.random().toString(36).slice(2,6)}`,
          price: it.price ?? it.unit_price ?? 0,
          status: it.status,
          quantity: it.quantity ?? it.qty ?? 0,
          sku_code: it.sku_code ?? it.sku_code_snapshot ?? it.sku ?? undefined,
          sku: it.sku ?? it.sku_code ?? undefined,
          thumbnail: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
          imageUrl: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
          is_waitlist_item: it.is_waitlist_item ?? it.is_waitlist ?? it.isWaitlist ?? false,
          variation: it.variation_text ?? it.variation_snapshot ?? it.variation ?? undefined,
          remarks: it.remark ?? it.remarks ?? null,
          payment_deadline: it.payment_deadline ?? it.deadline ?? null,
          waitlist_filled_at: it.waitlist_filled_at ?? null,
          restock_notified_at: it.restock_notified_at ?? null,
        })),
      })),
    }))
  }, [bulkData, currentIndex])

  const totalAmount = useMemo(() => {
    return transactionsMapped.reduce((sum: number, tx: any) => {
      const v = Number(tx.transaction_total ?? tx.transaction_total_amount ?? 0) || 0
      return sum + v
    }, 0)
  }, [transactionsMapped])
  // Use the raw RPC `transaction_total` field when available for the overall summary
  const totalAmountRpc = useMemo(() => {
    const b = bulkData[currentIndex]
    if (!b || !Array.isArray(b.transactions)) return 0
    return b.transactions.reduce((s: number, t: any) => s + (Number(t.transaction_total ?? t.transaction_total_amount ?? 0) || 0), 0)
  }, [bulkData, currentIndex])
  // Use RPC `total_orders` when available; fall back to counting mapped orders
  const totalOrdersRpc = useMemo(() => {
    const b = bulkData[currentIndex]
    if (!b || !Array.isArray(b.transactions)) return 0
    return b.transactions.reduce((s: number, t: any) => s + (Number(t.total_orders ?? (Array.isArray(t.orders) ? t.orders.length : 0)) || 0), 0)
  }, [bulkData, currentIndex])
  const [prefillMessage, setPrefillMessage] = useState("")
  const [lastNotifiedCustomerId, setLastNotifiedCustomerId] = useState<string | null>(null)
  const [lastNotifiedTransactionId, setLastNotifiedTransactionId] = useState<string | null>(null)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [contactedCustomerIds, setContactedCustomerIds] = useState<string[]>([])
  const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
  const hasTransactionForCurrent = Boolean(lastNotifiedCustomerId && lastNotifiedCustomerId === currentCustomerId && lastNotifiedTransactionId)

  useEffect(() => {
    const name = bulkData[currentIndex]?.customer_info?.customer_name ?? "客戶"
    const whatsapp = bulkData[currentIndex]?.customer_info?.phone ?? ""
    const flattenedOrders = transactionsMapped.flatMap((t: any) => t.orders || [])
    const orderNumbers = flattenedOrders.map((o: any) => o.order_number).join(", ")
    const numOrders = flattenedOrders.length
    const total = totalAmount ? totalAmount.toLocaleString() : "0"
    const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null

    // compute earliest payment deadline from order items (if present)
    const paymentDeadlines: string[] = flattenedOrders.flatMap((og: any) => (og.items || []).map((it: any) => it.payment_deadline || it.deadline).filter(Boolean))
    let formattedDeadline: string | null = null
    let hoursRemainingText: string | null = null
    if (paymentDeadlines.length > 0) {
      const parsed = paymentDeadlines.map((d: string) => Date.parse(d)).filter((t: number) => !isNaN(t))
      if (parsed.length > 0) {
        const earliest = Math.min(...parsed)
        formattedDeadline = new Date(earliest).toLocaleString()
        const hoursRemaining = Math.max(0, Math.ceil((earliest - Date.now()) / (1000 * 60 * 60)))
        hoursRemainingText = `${hoursRemaining}`
      }
    }

    const deadlineText = (formattedDeadline && hoursRemainingText)
      ? `還有 ${hoursRemainingText} 小時（截止： ${formattedDeadline}）`
      : null

    const baseMsg = `嗨 ${name} 👋\n\n你嘅訂單 ${orderNumbers || "—"}（共 ${numOrders} 張）📦 已備貨完成，準備安排出貨。總金額 HK$${total}。\n\n` +
      `如有特別要求請在回覆中告知。\n\n多謝你！🙏`

    // If a transaction (or transactions) exist, include links to the order-history
    // for each transaction so the customer can view order details.
    let finalMsg = baseMsg
    const txs = (transactionsMapped || []).map((t: any) => t.transaction_id).filter(Boolean).map(String)
    if (txs.length > 0) {
      const origin = (typeof window !== "undefined" && window.location?.origin) ? window.location.origin : ''

      finalMsg = `嗨 ${name} 👋\n\n你嘅訂單 ${orderNumbers || "—"}（共 ${numOrders} 張）📦 已備貨完成，準備發貨。詳情可於以下訂單紀錄查看：\n\n`

      if (txs.length === 1) {
        const tx = txs[0]
        const phoneParam = whatsapp ? encodeURIComponent((whatsapp || '').replace(/[^0-9+]/g, '')) : ''
        const txParam = encodeURIComponent(tx)
        const orderUrl = origin
          ? `${origin}/order-history?phone=${phoneParam}&tx=${txParam}`
          : `/order-history?phone=${phoneParam}&tx=${txParam}`
        finalMsg += `訂單紀錄：${orderUrl}\n\n` +
          `若需更改請直接回覆此訊息。\n\n多謝你！🙏\n\n交易編號: ${tx}`
      } else {
        const phoneParam = whatsapp ? encodeURIComponent((whatsapp || '').replace(/[^0-9+]/g, '')) : ''
        for (const tx of txs) {
          const txParam = encodeURIComponent(tx)
          const orderUrl = origin
            ? `${origin}/order-history?phone=${phoneParam}&tx=${txParam}`
            : `/order-history?phone=${phoneParam}&tx=${txParam}`
          finalMsg += `- ${orderUrl} \n`
        }
        finalMsg += `\n若需更改請直接回覆此訊息。\n\n多謝你！🙏`
      }
    }

    setPrefillMessage(finalMsg)
  }, [bulkData, currentIndex, transactionsMapped, totalAmount, lastNotifiedCustomerId, lastNotifiedTransactionId])

  

  function handleResend() {
    // open WhatsApp again with the current prefillMessage (which should include tx and pay link)
    try {
      const phone = ((bulkData[currentIndex]?.customer_info?.phone) || "").replace(/[^0-9+]/g, "")
      if (!phone) {
        console.warn('handleResend: no phone available for current customer', { currentIndex, bulkDataEntry: bulkData[currentIndex] })
        return
      }
      const msg = prefillMessage || ""
      console.log('handleResend:', { phone, msgPreview: msg.slice(0, 120) })
      if (typeof window !== "undefined") {
        const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`
        window.open(url, "_blank")
      }
      // mark this customer as contacted in the UI flow
      const currentCustId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
      if (currentCustId) {
        setContactedCustomerIds((prev) => (prev.includes(currentCustId) ? prev : [...prev, currentCustId]))
        setLastNotifiedCustomerId(currentCustId)
        const firstTx = transactionsMapped[0]?.transaction_id ?? null
        if (firstTx) setLastNotifiedTransactionId(firstTx)
      }
    } catch (e) {
      console.error('handleResend failed', e)
    }
  }

  async function handleContactedClick() {
    // Call RPC to mark restock notified for the current customer's transactions
    try {
      const txs = (transactionsMapped || []).map((t: any) => t.transaction_id).filter(Boolean).map(String)
      if (txs.length > 0) {
        setLoading(true)
        await markRestockNotified(txs)
      }
    } catch (e) {
      console.error('markRestockNotified failed', e)
    } finally {
      setLoading(false)
    }

    // If not the last customer, advance to next and reset notified markers.
    if (currentIndex < (bulkData.length - 1)) {
      setLastNotifiedCustomerId(null)
      setLastNotifiedTransactionId(null)
      setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))
      return
    }

    // Last customer: show completion dialog then close on confirm
    setShowCompleteConfirm(true)
  }

  async function handleRevert() {
    // kept for backward-compat; prefer using reverseConfirmedOrder via dialog choices
    if (!lastNotifiedCustomerId) return
    try {
      await revertAllocatedToConfirmed(lastNotifiedCustomerId)
      setLastNotifiedCustomerId(null)
      setLastNotifiedTransactionId(null)
    } catch (e) {
      console.error('Failed to revert', e)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs h-[100vh]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-[90vw] max-w-[400px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
       

        {/* Header */}
        <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
          <div className=" text-xs text-gray-600">到貨通知</div>
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

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {/* Summary row */}
          <div className="flex items-end justify-between mb-9">
            <div>

              
               
              <div className="text-xs text-gray-700 mb-2">共{totalOrdersRpc} 筆交易</div>
              <div className="text-xs font-semibold">總額 ${totalAmountRpc.toLocaleString()}</div>
            
            </div>

            <div className="flex items-center gap-2">
              {contactedCustomerIds.includes(currentCustomerId ?? '') ? (
                <button
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs"
                  onClick={handleContactedClick}
                  disabled={loading}
                >
                  已聯絡此顧客
                </button>
              ) : (
                <button
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs"
                  onClick={handleResend}
                  // allow resend if we have a phone and a message to send; do not require a transaction id
                  disabled={loading || transactionsMapped.flatMap((t: any) => t.orders || []).length === 0 || !(bulkData[currentIndex]?.customer_info?.phone && prefillMessage)}
                >
                  發送到貨通知
                </button>
              )}
            </div>
          </div>

          {showRevertConfirm && (
            <div className=" absolute inset-0 z-50 flex items-center justify-center">
              <div className="absolute h-[100vh] inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowRevertConfirm(false)} />
              <div className="relative z-50 w-full max-w-[400px] bg-white rounded-lg shadow-lg p-4">
                <div className="text-sm text-center text-gray-700 mb-4">請選擇以下動作</div>
                <div className="flex justify-between gap-2">
                  <button
                    className="px-3 py-1 text-sm text-gray-500"
                    onClick={() => setShowRevertConfirm(false)}
                  >
                    關閉
                  </button>

                <div className="flex gap-4">  
                  <button
                    className="px-3 py-1 rounded  text-red-600 text-sm"
                    onClick={async () => {
                      if (!lastNotifiedCustomerId) return
                      try {
                        await reverseConfirmedOrder(lastNotifiedCustomerId, lastNotifiedTransactionId, 'cancel')
                        setLastNotifiedCustomerId(null)
                        setLastNotifiedTransactionId(null)
                      } catch (e) {
                        console.error('Failed to cancel order', e)
                      } finally {
                        setShowRevertConfirm(false)
                      }
                    }}
                  >
                    取消訂單
                  </button>

                  <button
                    className="px-3 py-1 rounded bg-gray-200 text-sm"
                    onClick={async () => {
                      if (!lastNotifiedCustomerId) return
                      try {
                        await reverseConfirmedOrder(lastNotifiedCustomerId, lastNotifiedTransactionId, 'undo')
                        setLastNotifiedCustomerId(null)
                        setLastNotifiedTransactionId(null)
                      } catch (e) {
                        console.error('Failed to undo', e)
                      } finally {
                        setShowRevertConfirm(false)
                      }
                    }}
                  >
                    還原
                  </button>
                </div>  
                </div>
              </div>
            </div>
          )}

          {showCompleteConfirm && (
            <div className=" absolute inset-0 z-50 flex items-center justify-center">
              <div className="absolute h-[100vh] inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setShowCompleteConfirm(false)} />
              <div className="relative z-50 w-[200px] bg-white rounded-lg shadow-lg p-4">
                <div className="text-sm text-center text-gray-700 mb-4">已聯絡所有顧客</div>
                <div className="flex justify-center gap-2">
                 
                  <button
                    className="px-3 py-1 rounded bg-primary text-white text-sm"
                    onClick={() => {
                      onConfirm?.(selectedOrderKeys)
                      setShowCompleteConfirm(false)
                      onOpenChange(false)
                    }}
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders list (simple card style matching screenshot) */}
          
          <div className="space-y-3">
            {transactionsMapped.length === 0 ? (
              <div className="text-sm text-gray-500">{loading ? "載入中…" : "沒有選取任何訂單"}</div>
            ) : (
              transactionsMapped.map((tx: any, tIdx: number) => (
                <div key={tx.transaction_id ?? `tx_${tIdx}`} className="bg-gray-100 shadow-sm rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold">交易編號：{tx.transaction_id ?? '—'}</div>
                    <div className="text-xs text-black font-bold">合計 ${Number(tx.transaction_total || 0).toLocaleString()}</div>
                  </div>

                  <div className="space-y-2">
                    {tx.orders.map((og: any) => (
                      <OrderCard
                        key={og.order_number ?? `${tx.transaction_id}_${Math.random().toString(36).slice(2,6)}`}
                        order={og}
                        className="bg-white rounded-xl shadow"
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

         

          {/* Preset message box */}
          <div>
            <div className=" text-[10px] text-gray-500">預覽訊息</div>
            <textarea
              value={prefillMessage}
              onChange={(e) => setPrefillMessage(e.target.value)}
              className="mt-2 w-full h-36 rounded-lg border border-gray-200 p-3 text-xs resize-none"
            ></textarea>

            {!hasTransactionForCurrent && (
              <div className="mt-2 text-xs text-gray-500">訂單詳情連結會自動加入訊息，發送後可再編輯或複製。</div>
            )}

            <div className="mt-2 flex gap-2">

            </div>
           
            
          </div>

         
        </div>
      </div>
    </div>
  )
}

