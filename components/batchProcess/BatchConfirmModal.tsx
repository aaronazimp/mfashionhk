"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import { fetchBulkCustomerOrders, processAllocatedToConfirmed, reverseConfirmedOrder } from "../../lib/orderService"
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
    } else {
      setActiveCustomerIds(null)
      setBulkData([])
      setCurrentIndex(0)
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

  const extractedOrderGroups = useMemo(() => {
    // Show orders for the selected customer only. RPC `orders_by_status` maps status -> { orders: OrderGroup[], status_total?: number }
    const b = bulkData[currentIndex]
    const groups = b
      ? Object.values(b?.orders_by_status ?? {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
      : []

    return groups.map((og: any) => ({
      order_number: og.order_number,
      order_total: og.order_total ?? og.order_total_amount ?? 0,
        items: (og.items || []).map((it: any) => ({
        item_id: it.line_item_id ?? it.item_id ?? `${og.order_number}_${Math.random().toString(36).slice(2,6)}`,
        price: it.price ?? it.unit_price ?? 0,
        status: it.status,
        quantity: it.quantity,
        sku_code: it.sku_code ?? it.sku_code_snapshot ?? it.sku ?? undefined,
        sku: it.sku ?? it.sku_code ?? undefined,
        thumbnail: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
        imageUrl: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
        // preserve waitlist/preorder flag so child components can show badge
        is_waitlist_item: it.is_waitlist_item ?? it.is_waitlist ?? it.isWaitlist ?? false,
        variation: it.variation_text ?? it.variation_snapshot ?? it.variation ?? undefined,
        remarks: it.remark ?? it.remarks ?? null,
        payment_deadline: it.payment_deadline ?? it.deadline ?? null,
      })),
    }))
  }, [bulkData, currentIndex])

  const totalAmount = useMemo(() => {
    return extractedOrderGroups.reduce((sum: number, og: any) => {
      const v = Number(og.order_total ?? og.order_total_amount ?? 0) || 0
      return sum + v
    }, 0)
  }, [extractedOrderGroups])
  const [prefillMessage, setPrefillMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [lastNotifiedCustomerId, setLastNotifiedCustomerId] = useState<string | null>(null)
  const [lastNotifiedTransactionId, setLastNotifiedTransactionId] = useState<string | null>(null)
  
  const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
  const hasTransactionForCurrent = Boolean(lastNotifiedCustomerId && lastNotifiedCustomerId === currentCustomerId && lastNotifiedTransactionId)

  useEffect(() => {
    const name = bulkData[currentIndex]?.customer_info?.customer_name ?? "客戶"
    const whatsapp = bulkData[currentIndex]?.customer_info?.phone ?? ""
    const orderNumbers = extractedOrderGroups.map((o: any) => o.order_number).join(", ")
    const numOrders = extractedOrderGroups.length
    const total = totalAmount ? totalAmount.toLocaleString() : "0"
    const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null

    // compute earliest payment deadline from order items (if present)
    const paymentDeadlines: string[] = extractedOrderGroups.flatMap((og: any) => (og.items || []).map((it: any) => it.payment_deadline || it.deadline).filter(Boolean))
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

    const baseMsg = `嗨 ${name} 👋\n\n你嘅訂單 ${orderNumbers || "—"}（共 ${numOrders} 張），總金額 HK$${total}。\n\n` +
      `我們已為你準備付款連結。請點擊下面嘅連結並完成付款${deadlineText ? `（${deadlineText}）` : '。'}付款完成後系統會自動更新訂單狀態。如有查詢，請直接回覆此訊息。\n\n多謝你！🙏`

    // If a transaction was created for this customer, include tx and payment link
    const tx = (lastNotifiedCustomerId && lastNotifiedCustomerId === currentCustomerId) ? lastNotifiedTransactionId : null
    let finalMsg = baseMsg
    if (tx) {
      const payPath = `/pay/${tx}`
      const payUrl = (typeof window !== "undefined" && window.location?.origin)
        ? `${window.location.origin}${payPath}`
        : payPath
      // build exact requested template
      const hoursText = hoursRemainingText ?? '12'
      const deadlineDisplay = formattedDeadline ? new Date(Math.min(...(paymentDeadlines.map(d=>Date.parse(d)).filter(t=>!isNaN(t))))) .toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
      finalMsg = `嗨 ${name} 👋\n\n你嘅訂單 ${orderNumbers || "—"}（共 ${numOrders} 張），總金額 HK$${total}。\n\n`
      finalMsg += `我們已為你準備付款連結：${payUrl}\n\n`
      finalMsg += `請於${hoursText} 小時內點擊以上連結付款。\n\n`
      finalMsg += `限時過後仍未收到付款系統自動取消並當棄單。\n如有查詢，請直接回覆此訊息。\n\n多謝你！🙏\n\n`
      finalMsg += `交易編號: ${tx}\n\n`
      if (deadlineDisplay) finalMsg += `截止時間： ${deadlineDisplay}`
    }

    setPrefillMessage(finalMsg)
  }, [bulkData, currentIndex, extractedOrderGroups, totalAmount, lastNotifiedCustomerId, lastNotifiedTransactionId])

  async function handleSendAndOpen() {
    if (loading || sending) return
    const customerId = bulkData[currentIndex]?.customer_info?.customer_id
    if (!customerId) return

    try {
      setSending(true)
      const res = await processAllocatedToConfirmed(customerId)
      console.log('processAllocatedToConfirmed RPC response', { customerId, res })
      setLastNotifiedCustomerId(customerId)
      // robustly attempt to find a transaction id anywhere in the response
      const tx = extractTransactionId(res)
      console.log('extracted tx', { tx })
      setLastNotifiedTransactionId(tx)

      // build message including transaction id if present
      let msgWithTx = tx ? `${prefillMessage}\n\n交易編號: ${tx}` : prefillMessage
      // include a payment link in format /pay/{transaction_id} (use full origin so WhatsApp shows clickable link)
      if (tx) {
        const payPath = `/pay/${tx}`
        const payUrl = (typeof window !== "undefined" && window.location?.origin)
          ? `${window.location.origin}${payPath}`
          : payPath
        msgWithTx = `${msgWithTx}\n\n付款連結：${payUrl}`
      }

      // update textarea to include tx and payment link
      setPrefillMessage(msgWithTx)

      // Open WhatsApp with message containing transaction id and payment link
      const phone = ((bulkData[currentIndex]?.customer_info?.phone) || "").replace(/[^0-9+]/g, "")
      if (phone && typeof window !== "undefined") {
        const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(msgWithTx)}`
        window.open(url, "_blank")
      }

      // keep on the same customer so admin can resend or revert
    } catch (e) {
      console.error('Failed to process and notify', e)
    } finally {
      setSending(false)
    }
  }

  function handleResend() {
    // open WhatsApp again with the current prefillMessage (which should include tx and pay link)
    const phone = ((bulkData[currentIndex]?.customer_info?.phone) || "").replace(/[^0-9+]/g, "")
    if (!phone) return
    const msg = prefillMessage
    if (typeof window !== "undefined") {
      const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`
      window.open(url, "_blank")
    }
  }


  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-24">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs h-[100vh]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-full max-w-[90vw] bg-white rounded-3xl shadow-2xl overflow-hidden ">
       

        {/* Header */}
        <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
          <div className=" text-xs text-gray-600">發送到貨及付款通知</div>
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

            <div className="text-xs text-gray-500">
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
              {bulkData[currentIndex]?.customer_info?.customer_name ?? "—"}
            </div>
            <div className="text-xs font-semibold text-gray-700">|</div>
            <div className="text-xs font-semibold">{bulkData[currentIndex]?.customer_info?.phone ?? "—"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[65vh] overflow-auto">
          {/* Summary row */}
          <div className="flex items-center justify-between">
            <div>
            
              <div className="text-sm text-gray-700">{extractedOrderGroups.length} 張訂單</div>
              <div className="text-xs font-semibold">總額 ${totalAmount.toLocaleString()}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
                onClick={lastNotifiedCustomerId === bulkData[currentIndex]?.customer_info?.customer_id ? handleResend : handleSendAndOpen}
                disabled={loading || sending || extractedOrderGroups.length === 0}
              >
                {lastNotifiedCustomerId === bulkData[currentIndex]?.customer_info?.customer_id ? '重發付款連結' : '發送付款通知'}
              </button>

              {lastNotifiedCustomerId && (
                null
              )}
            </div>
          </div>
          

          {/* Orders list (simple card style matching screenshot) */}
          
          <div className="space-y-3">
            {extractedOrderGroups.length === 0 ? (
              <div className="text-sm text-gray-500">
                {loading ? "載入中…" : "沒有選取任何訂單"}
              </div>
            ) : (
              extractedOrderGroups.map((og) => (
                <OrderCard
                  key={og.order_number}
                  order={og}
                  className="bg-white rounded-xl shadow max-h-96 overflow-hidden"
                />
              ))
            )}
          </div>

         

          {/* Preset message box */}
          <div className="relative">
            
            <textarea
              value={prefillMessage}
              onChange={(e) => setPrefillMessage(e.target.value)}
              className="mt-4 w-full h-36 rounded-lg border border-gray-200 p-3 text-xs resize-none"
            />

            {!hasTransactionForCurrent && (
              <div className="mt-2 text-xs text-gray-500">付款連結及交易編號會於按「發送付款通知」並生成交易後自動加入訊息，發送後可再編輯或複製。</div>
            )}

            <div className="mt-2 flex gap-2">

            </div>
            {/* Action row: Next / Complete shown under preset message when a payment link was sent */}
            {lastNotifiedCustomerId && (
              <div className="mt-3 flex justify-center">
                {lastNotifiedCustomerId === bulkData[bulkData.length - 1]?.customer_info?.customer_id ? (
                  <button
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm"
                    onClick={() => {
                      onConfirm?.(selectedOrderKeys)
                      onOpenChange(false)
                    }}
                  >
                    完成
                  </button>
                ) : (
                  bulkData.length > 1 && (
                    <button
                      className="px-4 py-2 rounded-lg bg-primary text-sm"
                      onClick={() => setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))}
                      disabled={loading || currentIndex >= bulkData.length - 1}
                    >
                      下一位顧客
                    </button>
                  )
                )}
              </div>
            )}
          </div>

         
        </div>
      </div>
    </div>
  )
}


