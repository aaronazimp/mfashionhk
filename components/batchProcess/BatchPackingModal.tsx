"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import ImageFullscreen from "../ImageFullscreen"
import { fetchBulkCustomerOrders, revertAllocatedToConfirmed, bulkMoveToPendingToShip, bulkVerifyPayments } from "../../lib/orderService"
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

export default function BatchVerifiedModal({
  open,
  onOpenChange,
  selectedOrderKeys = [],
  onConfirm,
  customerIds,
  statusFilter,
}: Props) {
  // (removed WhatsApp transaction extraction helper)
  console.log('BatchVerifiedModal render', { open, selectedOrderKeys, customerIds, statusFilter, onConfirmType: typeof onConfirm })
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

  // (removed automatic extraction of transaction ids from bulkData)

  const extractedOrderGroups = useMemo(() => {
    // Map orders for the selected customer using the new `BulkCustomerOrderRecord` shape
    const b = bulkData[currentIndex]
    if (!b || !Array.isArray(b.transactions) || b.transactions.length === 0) return []

    return b.transactions.flatMap((tx: any) => {
      const orders = tx.orders || []
      return orders.map((o: any) => ({
        order_number: o.order_number,
        order_total: o.order_total ?? o.order_total_amount ?? o.transaction_total ?? tx.transaction_total ?? 0,
        payment_proof_url: o.payment_proof_url ?? tx.payment_proof_url ?? null,
        transaction_id: o.transaction_id ?? tx.transaction_id ?? tx.transaction_group_id ?? null,
        status: o.order_status ?? o.order_status ?? null,
        items: (o.items || []).map((it: any) => ({
          item_id: it.line_item_id ?? it.item_id ?? String(it.id ?? ''),
          price: it.price ?? it.unit_price ?? 0,
          status: it.status ?? null,
          quantity: it.quantity ?? it.qty ?? 0,
          sku_code: it.sku_code ?? it.sku_code_snapshot ?? undefined,
          sku: it.sku ?? it.sku_code ?? undefined,
          thumbnail: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
          imageUrl: it.main_image ?? it.imageUrl ?? it.thumbnail ?? null,
          payment_proof_url: it.payment_proof_url ?? o.payment_proof_url ?? tx.payment_proof_url ?? null,
          receipt_url: it.receipt_url ?? null,
          transaction_id: it.transaction_id ?? o.transaction_id ?? tx.transaction_id ?? null,
          is_waitlist_item: it.is_waitlist_item ?? it.is_waitlist ?? false,
          variation: it.variation_text ?? it.variation_snapshot ?? it.variation ?? undefined,
          remarks: it.remark ?? it.remarks ?? null,
          payment_deadline: it.payment_deadline ?? it.deadline ?? null,
        })),
      }))
    })
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
  
  // Build a per-transaction view from the BulkCustomerOrderRecord `transactions`
  const extractedTransactions = useMemo(() => {
    const b = bulkData[currentIndex]
    if (!b || !Array.isArray(b.transactions) || b.transactions.length === 0) return []

    return b.transactions.map((tx: any) => {
      const orders = (tx.orders || []).map((o: any) => ({
        order_number: o.order_number,
        order_total: o.order_total ?? o.order_total_amount ?? o.transaction_total ?? tx.transaction_total ?? 0,
        payment_proof_url: o.payment_proof_url ?? tx.payment_proof_url ?? null,
        transaction_id: o.transaction_id ?? tx.transaction_id ?? tx.transaction_group_id ?? null,
        status: o.order_status ?? null,
        items: (o.items || []).map((it: any) => ({
          item_id: it.line_item_id ?? it.item_id ?? String(it.id ?? ''),
          price: it.price ?? it.unit_price ?? 0,
          status: it.status ?? null,
          quantity: it.quantity ?? it.qty ?? 0,
          sku_code: it.sku_code ?? it.sku_code_snapshot ?? undefined,
          sku: it.sku ?? it.sku_code ?? undefined,
          thumbnail: it.main_image ?? it.thumbnail ?? it.imageUrl ?? null,
          imageUrl: it.main_image ?? it.imageUrl ?? it.thumbnail ?? null,
          payment_proof_url: it.payment_proof_url ?? o.payment_proof_url ?? tx.payment_proof_url ?? null,
          receipt_url: it.receipt_url ?? null,
          transaction_id: it.transaction_id ?? o.transaction_id ?? tx.transaction_id ?? null,
          is_waitlist_item: it.is_waitlist_item ?? it.is_waitlist ?? false,
          variation: it.variation_text ?? it.variation_snapshot ?? it.variation ?? undefined,
          remarks: it.remark ?? it.remarks ?? null,
          payment_deadline: it.payment_deadline ?? it.deadline ?? null,
        })),
      }))

      const transaction_total = orders.reduce((s: number, o: any) => s + (Number(o.order_total) || 0), 0)
      const total_items = orders.reduce((s: number, o: any) => s + ((o.items || []).reduce((si: number, it: any) => si + (Number(it.quantity) || 0), 0)), 0)
      const payment_proof_url = tx.payment_proof_url ?? (orders[0]?.payment_proof_url) ?? null
      const transaction_id = tx.transaction_id ?? tx.transaction_group_id ?? (orders[0]?.transaction_id) ?? null

      return {
        transaction_id,
        payment_proof_url,
        orders,
        transaction_total,
        total_items,
        raw: tx,
      }
    })
  }, [bulkData, currentIndex])

  // Progress totals: total items across displayed transactions and
  // how many of those items are marked `pre_pending_to_ship`.
  const packingProgress = useMemo(() => {
    let total = 0
    let pre = 0
    for (const tx of extractedTransactions) {
      total += Number(tx.total_items || 0)
      for (const o of tx.orders || []) {
        for (const it of o.items || []) {
          const qty = Number(it.quantity || 0)
          total += 0 // already counted at tx level via total_items
          if (String(it.status) === 'pre_pending_to_ship') pre += qty
        }
      }
    }
    // ensure we don't double-count: use tx.total_items for total when available
    const totalFromTx = extractedTransactions.reduce((s: number, t: any) => s + (Number(t.total_items) || 0), 0)
    const finalTotal = totalFromTx || total
    const percent = finalTotal > 0 ? Math.round((pre / finalTotal) * 100) : 0
    return { total: finalTotal, pre, percent }
  }, [extractedTransactions])

  // Removed per-transaction expand/collapse state — orders are always shown now.

  async function handleConfirmTransactionForTx(txId: string | null) {
    if (!txId) {
      console.warn('handleConfirmTransactionForTx: no txId provided')
      return
    }
    let prevBulk: BulkCustomerOrderRecord[] | null = null
    try {
      // Optimistic local removal for snappy UX: remove tx locally and
      // mark confirmed, then call RPC. Rollback if RPC fails.
      prevBulk = bulkData
      setBulkData((bd) => {
        const copy = bd.map((b) => ({ ...b }))
        if (copy[currentIndex] && Array.isArray(copy[currentIndex].transactions)) {
          copy[currentIndex].transactions = copy[currentIndex].transactions.filter((t: any) => t.transaction_id !== txId)
        }
        return copy
      })

      markConfirmed(currentCustomerId, [txId])

      setLoading(true)
      await bulkVerifyPayments([txId])
      console.log('bulk verify single tx success', { txId })

      // Advance only when all txs for this customer are confirmed.
      checkAndAdvanceIfComplete(currentCustomerId)
    } catch (e) {
      console.error('confirm single transaction failed', e)
      // rollback optimistic changes
      try {
        if (prevBulk) setBulkData(prevBulk)
        else if (prevBulkDataRef.current) setBulkData(JSON.parse(prevBulkDataRef.current))
      } catch (err) {
        console.error('rollback failed', err)
      }
      setConfirmedMap((prev) => {
        if (!currentCustomerId) return prev
        const set = new Set<string>(prev[currentCustomerId] ?? [])
        set.delete(txId as string)
        return { ...prev, [currentCustomerId]: Array.from(set) }
      })
    } finally {
      setLoading(false)
    }
  }

  // Move current customer's transactions to `pending_to_ship` when packing complete
  async function handleCompletePacking() {
    setLoading(true)
    try {
      const txs: string[] = extractedTransactions.map((t: any) => t.transaction_id).filter(Boolean).map(String)
      if (txs.length === 0) {
        console.warn('handleCompletePacking: no transaction ids')
        return
      }

      try {
        await bulkMoveToPendingToShip(txs)
      } catch (e) {
        console.error('bulkMoveToPendingToShip failed', e)
        return
      }

      // refresh snapshot for current active customers and decide whether to
      // auto-advance to the next customer or show the completion dialog.
      let refreshed: BulkCustomerOrderRecord[] | null = null
      try {
        const ids = activeCustomerIds ?? []
        if (ids.length) {
          refreshed = await fetchBulkCustomerOrders(ids, statusFilter)
          setBulkData(refreshed)
        }
      } catch (e) {
        console.warn('Failed to refresh after bulkMoveToPendingToShip', e)
      }

      try {
        const refreshedList = Array.isArray(refreshed) ? refreshed : (Array.isArray(bulkData) ? bulkData : [])
        const newLen = refreshedList.length

        if (newLen === 0) {
          // no customers remain
          setBatchCompleteOpen(true)
        } else {
          // Determine index of current customer in refreshed list
          const idx = refreshedList.findIndex((b: any) => (b?.customer_info?.customer_id ?? null) === currentCustomerId)
          let nextIndex = currentIndex
          if (idx >= 0) {
            // current customer still present in refreshed list — advance to the next one
            nextIndex = idx + 1
          } else {
            // current customer removed — the next customer (if any) now sits at the same index
            nextIndex = currentIndex
          }

          if (nextIndex < newLen) {
            setCurrentIndex(nextIndex)
          } else {
            // we've reached the end
            setBatchCompleteOpen(true)
          }
        }
      } catch (e) {
        setBatchCompleteOpen(true)
      }
    } catch (e) {
      console.error('handleCompletePacking failed', e)
    } finally {
      setLoading(false)
    }
  }

  
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false)
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null)
  // Track confirmed transaction ids per customer so we only advance when
  // every transaction for a customer has been confirmed.
  const [confirmedMap, setConfirmedMap] = useState<Record<string, string[]>>({})

  function markConfirmed(customerId: string | null, txIds: string[]) {
    if (!customerId || txIds.length === 0) return
    setConfirmedMap((prev) => {
      const set = new Set<string>(prev[customerId] ?? [])
      txIds.forEach((id) => id && set.add(id))
      return { ...prev, [customerId]: Array.from(set) }
    })
  }

  function isAllConfirmedForCustomer(customerId: string | null) {
    if (!customerId) return false
    const customerRecord = bulkData.find((b) => b?.customer_info?.customer_id === customerId)
    const expected = (customerRecord?.transactions || []).map((t: any) => t.transaction_id).filter(Boolean)
    if (expected.length === 0) return false
    const confirmed = new Set<string>(confirmedMap[customerId] ?? [])
    return expected.every((id: string) => confirmed.has(id))
  }

  function checkAndAdvanceIfComplete(customerId: string | null) {
    if (!customerId) return
    if (!isAllConfirmedForCustomer(customerId)) return

    const customerIdx = bulkData.findIndex((b) => b?.customer_info?.customer_id === customerId)
    // If there's another customer after currentIndex, advance to them.
    if (bulkData.length > 1 && currentIndex < bulkData.length - 1) {
      setCurrentIndex((i) => Math.min(bulkData.length - 1, i + 1))
      return
    }

    // Last customer processed — show completion dialog
    setBatchCompleteOpen(true)
  }
  

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
    let prevBulk: BulkCustomerOrderRecord[] | null = null
    let txs: string[] = []
    try {
      console.log('確認交易 clicked', { customerId: currentCustomerId })
      // collect transaction ids from displayed orders
      txs = extractedOrderGroups.flatMap((og: any) => (og.items || []).map((it: any) => it.transaction_id).filter(Boolean))
      try {
        if (txs.length > 0) {
          // Optimistically remove these transactions locally and mark them
          // confirmed; rollback on RPC failure.
          prevBulk = bulkData
          setBulkData((bd) => {
            const copy = bd.map((b) => ({ ...b }))
            if (copy[currentIndex] && Array.isArray(copy[currentIndex].transactions)) {
              const remove = new Set(txs)
              copy[currentIndex].transactions = copy[currentIndex].transactions.filter((t: any) => !remove.has(t.transaction_id))
            }
            return copy
          })

          markConfirmed(currentCustomerId, txs as string[])

          setLoading(true)
          await bulkVerifyPayments(txs as string[])
          console.log('bulk verify success', { txCount: txs.length })
        } else {
          console.warn('handleConfirmTransaction: no transaction ids to verify')
        }
      } finally {
        setLoading(false)
      }

      // Only advance/show completion when all transactions for this
      // customer are confirmed.
      checkAndAdvanceIfComplete(currentCustomerId)
    } catch (e) {
      console.error('confirm transaction failed', e)
      // rollback optimistic removal and confirmed flags
      try {
        if (prevBulk) setBulkData(prevBulk)
        else if (prevBulkDataRef.current) setBulkData(JSON.parse(prevBulkDataRef.current))
      } catch (_) {
        // ignore
      }
      setConfirmedMap((prev) => {
        if (!currentCustomerId) return prev
        const set = new Set<string>(prev[currentCustomerId] ?? [])
        txs.forEach((id: string) => set.delete(id))
        return { ...prev, [currentCustomerId]: Array.from(set) }
      })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute  inset-0 bg-black/40 backdrop-blur-xs h-[100vh]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-[90vw] max-w-[400px] max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col">

        {/* Fixed header area (non-scrollable) */}
        <div className="flex-shrink-0">
          <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
            <div className=" text-xs text-gray-600">打包執貨</div>
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
          {batchCompleteOpen ? (
            <div className="absolute inset-0 z-60 flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/40 rounded-3xl pointer-events-auto backdrop-blur-xs" />
              <div className="relative bg-white rounded-xl shadow-lg p-6 w-[90vw] max-w-[400px] z-70 pointer-events-auto">
                <div className="text-sm font-semibold mb-2">已完成批次處理</div>
                <div className="text-xs text-gray-600 mb-4">您已處理完所有顧客。批次流程已完成。</div>
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 rounded bg-primary  text-xs text-white"
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

      

        {/* Packing progress (pre-picked / total) */}
        <div className="px-6 pt-3 pb-2">
          
          <div className="flex gap-2 mb-2">
          <div className="text-[10px] text-gray-600">打包進度</div>
           <div className="text-[10px] font-semibold text-gray-500">{packingProgress.pre} / {packingProgress.total} 件已標記打包 </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-emerald-500"
              style={{ width: `${packingProgress.percent}%` }}
            />
          </div>
          {packingProgress.total > 0 && packingProgress.pre >= packingProgress.total ? (
            <div className="mt-3 flex justify-center">
              <button
                className="px-2 py-1 rounded-md bg-emerald-600 text-white text-xs h-[24px] w-[99px]"
                onClick={() => handleCompletePacking()}
                disabled={loading}
              >
                完成打包
              </button>
            </div>
          ) : null}
         
        </div>

        {/* Body (scrollable) */}
        <div className="p-6 space-y-4 overflow-auto flex-1">
          {/* Transactions list: render one section per transaction id */}
          {extractedTransactions.length === 0 ? (
            <div className="text-xs text-center text-gray-500">{loading ? '載入中…' : '沒有選取任何交易'}</div>
          ) : (
            <div className="space-y-4">
              {extractedTransactions.map((tx: any, idx: number) => (
                <div key={tx.transaction_id ?? idx} className="bg-gray-100 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col w-full">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <div className="text-xs">交易編號</div>
                        <div className="text-xs">{tx.transaction_id ?? '—'}</div>
                      </div>
                      <div className="text-[10px] text-gray-700 mt-1">共 {tx.orders.length} 張訂單 | {tx.total_items} 件商品</div>
                      <div className="flex items-center justify-between mt-2 gap-2 w-full">
                        <div className="text-xs mt-2 font-semibold">總額 ${Number(tx.transaction_total).toLocaleString()}</div>
                        
                      </div>
                    </div>

                   
                    
                  </div>
                 

                  <div className="space-y-3 mt-3">
                    {tx.orders.map((og: any) => (
                      <OrderCard
                        key={og.order_number}
                        order={og}
                        className="bg-white rounded-xl shadow max-h-96 overflow-hidden"
                        onItemStatusChange={(itemId: string, newStatus: string) => {
                          // Optimistically update local bulkData so UI (packing progress)
                          // reflects the status change immediately without waiting for
                          // a server refresh.
                          try {
                            setBulkData((prev) => {
                              if (!Array.isArray(prev) || prev.length === 0) return prev
                              const copy = prev.map((b) => ({ ...b }))
                              const cur = copy[currentIndex]
                              if (!cur || !Array.isArray(cur.transactions)) return prev
                              cur.transactions = cur.transactions.map((t: any) => ({
                                ...t,
                                orders: (t.orders || []).map((o: any) => ({
                                  ...o,
                                  items: (o.items || []).map((it: any) => {
                                    const idsToCheck = [it.line_item_id, it.item_id, it.id].map((v: any) => (v == null ? '' : String(v)))
                                    if (idsToCheck.includes(String(itemId))) {
                                      return { ...it, status: newStatus }
                                    }
                                    return it
                                  }),
                                })),
                              }))
                              return copy
                            })
                          } catch (e) {
                            // ignore optimistic update errors
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/*
            Image fullscreen portal — mount once in this modal so clicks open the viewer
          */}
          <ImageFullscreen
            src={fullscreenSrc ?? ""}
            alt="receipt"
            open={Boolean(fullscreenSrc)}
            onClose={() => setFullscreenSrc(null)}
          />

         

         

          {/* Batch complete dialog */}
          {null}

         
        </div>
      </div>
    </div>
  )
}
