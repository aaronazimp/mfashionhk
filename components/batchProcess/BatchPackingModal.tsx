"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import { fetchBulkCustomerOrders, revertAllocatedToConfirmed, reverseConfirmedOrder, bulkMoveToPendingToShip } from "../../lib/orderService"
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
  const [bulkData, setBulkData] = useState<ActiveCustomerRecords[]>([])
  const [loading, setLoading] = useState(false)
  // Snapshot of customerIds captured when modal opens. While modal is open we
  // use this snapshot so parent changes don't force refetch/unmount flicker.
  const [activeCustomerIds, setActiveCustomerIds] = useState<string[] | null>(null)
  const prevBulkDataRef = React.useRef<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [preCount, setPreCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)

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
      try {
        // Notify global listeners (orders page) so realtime-driven UI resumes
        window.dispatchEvent(new CustomEvent('orders:refresh', { detail: { source: 'batchPackingModal:closed' } }))
      } catch (e) {
        // ignore
      }
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
        
        const serialized = JSON.stringify(data || [])
        if (mounted) {
          if (prevBulkDataRef.current !== serialized) {
            prevBulkDataRef.current = serialized
            setBulkData(data)
          }
        }
      } catch (e) {
        console.error("Failed to fetch bulk orders", e)
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

  // Handle item status changes from child OrderCard (optimistic updates)
  function handleItemStatusChange(itemId: string, newStatus: string, meta?: { source?: string }) {
    try {
      // record whether this status change originated from a swipe gesture
      _lastChangeBySwipeRef.current = meta?.source === 'swipe'
      
      // Quick optimistic update to progress counts so the progress bar updates immediately
      try {
        const flatItems = extractedOrderGroups.flatMap((og: any) => (og.items || []).map((it: any) => ({ ...it })))
        const found = flatItems.find((it: any) => String(it.item_id) === String(itemId) || String(it.item_id) === String(itemId))
        if (found) {
          const qty = Number(found.quantity) || 0
          const wasPre = String(found.status) === 'pre_pending_to_ship'
          const nowPre = String(newStatus) === 'pre_pending_to_ship'
          const delta = (nowPre ? qty : 0) - (wasPre ? qty : 0)
          if (delta !== 0) {
            setPreCount((p) => Math.max(0, p + delta))
            setProgressPercent((_) => {
              const total = totalCount || 0
              const newPre = Math.max(0, (preCount + delta))
              return total > 0 ? Math.round((newPre / total) * 100) : 0
            })
          }
        }
      } catch (e) {
        // ignore optimistic update failures
      }

      setBulkData((prev) => {
        const next = prev.map((b, idx) => {
          if (idx !== currentIndex) return b
          try {
            const byStatus = b.orders_by_status || {}
            const nextByStatus: Record<string, any> = {}
            Object.entries(byStatus).forEach(([k, v]: any) => {
              const orders = (v?.orders || []).map((og: any) => ({
                ...og,
                items: (og.items || []).map((it: any) => {
                  const itId = String(it.line_item_id ?? it.item_id ?? it.id ?? '')
                  if (itId === String(itemId)) return { ...it, status: newStatus }
                  return it
                }),
              }))
              nextByStatus[k] = { ...(v || {}), orders }
            })
            return { ...b, orders_by_status: nextByStatus }
          } catch (e) {
            return b
          }
        })

        // compute progress counts from updated current customer (ensure canonical state)
        try {
          const cur = next[currentIndex]
          const totals = (cur ? Object.values(cur.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? [])) : []).reduce(
            (acc: { pre: number; total: number }, og: any) => {
              const items = og.items || []
              const itTotals = items.reduce(
                (a: { pre: number; total: number }, it: any) => {
                  const qty = Number(it.quantity) || 0
                  a.total += qty
                  if (String(it.status) === 'pre_pending_to_ship') a.pre += qty
                  return a
                },
                { pre: 0, total: 0 }
              )
              acc.pre += itTotals.pre
              acc.total += itTotals.total
              return acc
            },
            { pre: 0, total: 0 }
          )

          setPreCount(totals.pre)
          setTotalCount(totals.total)
          setProgressPercent(totals.total > 0 ? Math.round((totals.pre / totals.total) * 100) : 0)
        } catch (e) {
          // ignore
        }

        return next
      })

      
    } catch (e) {
      console.warn('handleItemStatusChange failed', e)
    }
  }

  // Recompute progress when bulkData or currentIndex changes (initial load or remote updates)
  useEffect(() => {
    try {
      const cur = bulkData[currentIndex]
      const totals = (cur ? Object.values(cur.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? [])) : []).reduce(
        (acc: { pre: number; total: number }, og: any) => {
          const items = og.items || []
          const itTotals = items.reduce(
            (a: { pre: number; total: number }, it: any) => {
              const qty = Number(it.quantity) || 0
              a.total += qty
              if (String(it.status) === 'pre_pending_to_ship') a.pre += qty
              return a
            },
            { pre: 0, total: 0 }
          )
          acc.pre += itTotals.pre
          acc.total += itTotals.total
          return acc
        },
        { pre: 0, total: 0 }
      )

      setPreCount(totals.pre)
      setTotalCount(totals.total)
      setProgressPercent(totals.total > 0 ? Math.round((totals.pre / totals.total) * 100) : 0)
    } catch (e) {
      // ignore
    }
  }, [bulkData, currentIndex])

  // (removed automatic extraction of transaction ids from bulkData)

  const extractedOrderGroups = useMemo(() => {
    // Show orders for the selected customer only. RPC `orders_by_status` maps status -> { orders: OrderGroup[], status_total?: number }
    const b = bulkData[currentIndex]
    const groups = b
      ? Object.values(b.orders_by_status).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
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
        receipt_url: it.receipt_url ?? it.payment_proof_url ?? null,
        transaction_id: it.transaction_id ?? it.tx ?? it.transaction ?? null,
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
  const totalQuantity = useMemo(() => {
    return extractedOrderGroups.reduce((sum: number, og: any) => {
      const itemsQty = (og.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
      return sum + itemsQty
    }, 0)
  }, [extractedOrderGroups])

  // true when there is at least one item and every item is marked pre_pending_to_ship
  const allItemsPrePending = useMemo(() => {
    try {
      const items = extractedOrderGroups.flatMap((og: any) => (og.items || []))
      if (!items || items.length === 0) return false
      return items.every((it: any) => String(it.status) === 'pre_pending_to_ship')
    } catch (e) {
      return false
    }
  }, [extractedOrderGroups])
  
  
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const currentCustomerId = bulkData[currentIndex]?.customer_info?.customer_id ?? null
  const [ordersExpanded, setOrdersExpanded] = useState<boolean>(true)
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false)
  const _autoAdvancedForIndexRef = React.useRef<number | null>(null)
  const _lastAutoTriggerIndexRef = React.useRef<number | null>(null)
  // persist overlay state per order so UI (revealed/translates) survives navigation
  const [overlaysByOrder, setOverlaysByOrder] = useState<Record<string, { translates?: Record<string, string>; revealed?: Record<string, 'left' | 'right' | false> }>>({})
  

  // (removed WhatsApp message composition and send/resend functions)

  // Auto-advance when the current customer's processed count meets the total.
  // Use a per-index guard so we only trigger once per customer.
  const _autoTriggeredRef = React.useRef<number | null>(null)
  const _justAutoAdvancedToRef = React.useRef<number | null>(null)
  const _manualNavRef = React.useRef<number | null>(null)
  const _lastChangeBySwipeRef = React.useRef<boolean>(false)
  const [pendingAdvance, setPendingAdvance] = useState<null | { fromIndex: number; toIndex?: number | null; customerId: string; timerId: number; timeoutMs: number; isAllDone?: boolean; startAt?: number }>(null)
  const [countdownSec, setCountdownSec] = useState<number>(0)
  useEffect(() => {
    try {
      // If we just auto-advanced to this index, skip scheduling a new pending dialog immediately.
      if (_justAutoAdvancedToRef.current === currentIndex) {
        _justAutoAdvancedToRef.current = null
        return
      }
      // Only trigger auto-advance dialog when the last status change was caused by a swipe
      if (!_lastChangeBySwipeRef.current) return
      // reset the flag so subsequent non-swipe updates won't retrigger
      _lastChangeBySwipeRef.current = false
      if (totalCount <= 0) return
      if (preCount < totalCount) return
      if (_autoTriggeredRef.current === currentIndex) return
      _autoTriggeredRef.current = currentIndex

      const len = bulkData.length
      if (!len) return

      // build per-customer totals to find next with remaining items
      const customerTotals = bulkData.map((b) => {
        try {
          const totals = (b ? Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? [])) : []).reduce(
            (acc: { pre: number; total: number }, og: any) => {
              const items = og.items || []
              const itTotals = items.reduce(
                (a: { pre: number; total: number }, it: any) => {
                  const qty = Number(it.quantity) || 0
                  a.total += qty
                  if (String(it.status) === 'pre_pending_to_ship') a.pre += qty
                  return a
                },
                { pre: 0, total: 0 }
              )
              acc.pre += itTotals.pre
              acc.total += itTotals.total
              return acc
            },
            { pre: 0, total: 0 }
          )
          return totals
        } catch (e) {
          return { pre: 0, total: 0 }
        }
      })

      const allDone = customerTotals.every((t) => t.total === 0 || t.pre >= t.total)

      const delay = 2000

      // If all customers are done, show batch-complete immediately (no countdown dialog)
      if (allDone) {
        setBatchCompleteOpen(true)
        return
      }

      // compute nextIndex now so UI can immediately let user act
      let nextIndex: number | null = null
      if (!allDone) {
        for (let j = currentIndex + 1; j < len; j++) {
          const t = customerTotals[j]
          if (!(t.total === 0 || t.pre >= t.total)) { nextIndex = j; break }
        }
        if (nextIndex == null) {
          for (let j = 0; j < len; j++) {
            const t = customerTotals[j]
            if (!(t.total === 0 || t.pre >= t.total)) { nextIndex = j; break }
          }
        }
      }

      const timer = window.setTimeout(() => {
        if (allDone) {
          setBatchCompleteOpen(true)
          setPendingAdvance(null)
          return
        }

        if (nextIndex != null) {
          // mark that we just auto-advanced to avoid immediately retriggering on the new index
          _justAutoAdvancedToRef.current = nextIndex
          setCurrentIndex(nextIndex)
        }
        setPendingAdvance(null)
      }, delay)

      // set a pending advance so UI can show undo dialog with countdown
      try {
        const cid = bulkData[currentIndex]?.customer_info?.customer_id ?? ''
        setPendingAdvance({ fromIndex: currentIndex, toIndex: nextIndex, customerId: cid, timerId: Number(timer), timeoutMs: delay, isAllDone: allDone, startAt: Date.now() } as any)
      } catch (e) {
        setPendingAdvance(null)
      }
    } catch (e) {
      // ignore
    }
  }, [preCount, totalCount, currentIndex, bulkData])

  // countdown timer for dialog (seconds)
  useEffect(() => {
    if (!pendingAdvance) { setCountdownSec(0); return }
    let mounted = true
    function tick() {
      if (!pendingAdvance) return
      const start = pendingAdvance.startAt ?? Date.now()
      const rem = Math.max(0, pendingAdvance.timeoutMs - (Date.now() - start))
      const sec = Math.ceil(rem / 1000)
      if (mounted) setCountdownSec(sec)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [pendingAdvance])

  // reset per-index trigger when user manually changes customer
  useEffect(() => {
    _autoTriggeredRef.current = null
    // if user manually navigates, cancel any pending auto-advance
    try {
      if (pendingAdvance) {
        window.clearTimeout(Number(pendingAdvance.timerId))
        setPendingAdvance(null)
      }
    } catch (e) {
      // ignore
    }
  }, [currentIndex])

  // clear pending advance when modal closes
  useEffect(() => {
    if (!open) {
      try {
        if (pendingAdvance) {
          window.clearTimeout(Number(pendingAdvance.timerId))
          setPendingAdvance(null)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [open])

  async function handleRevert() {
    // kept for backward-compat; prefer using reverseConfirmedOrder via dialog choices
    if (!currentCustomerId) return
    try {
      await revertAllocatedToConfirmed(currentCustomerId)
    } catch (e) {
      console.error('Failed to revert', e)
    }
  }

  async function handleUndoAdvance() {
    if (!pendingAdvance) return
    try {
      // stop the pending timer
      window.clearTimeout(Number(pendingAdvance.timerId))
    } catch (e) {
      // ignore
    }

    const cid = pendingAdvance.customerId
    setPendingAdvance(null)

    // Allow auto-advance to trigger again for this index after undo
    try {
      _autoTriggeredRef.current = null
      _justAutoAdvancedToRef.current = null
      _lastChangeBySwipeRef.current = false
    } catch (e) {
      // ignore
    }

    if (!cid) return

    try {
      // call server revert (best-effort)
      await revertAllocatedToConfirmed(cid)
      // refresh bulk data snapshot for current active customers
      try {
        const ids = activeCustomerIds ?? []
        if (ids.length) {
          const refreshed = await fetchBulkCustomerOrders(ids, statusFilter)
          // replace entire bulk data so counts recompute
          setBulkData(refreshed)
        }
      } catch (e) {
        console.warn('Failed to refresh after undo', e)
      }
    } catch (e) {
      console.error('Undo revert failed', e)
    }
  }

  // Cancel the pending auto-advance without calling any RPCs.
  function handleCancelPending() {
    if (!pendingAdvance) return
    try {
      window.clearTimeout(Number(pendingAdvance.timerId))
    } catch (e) {
      // ignore
    }
    setPendingAdvance(null)
    _lastChangeBySwipeRef.current = false
  }

  // Call server RPC to move transactions to pending_to_ship, then close modal
  async function handleBatchCompleteConfirm() {
    try {
      // collect all transaction ids across bulkData
      const txs: string[] = []
      for (const b of bulkData) {
        try {
          const orders = Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
          for (const og of orders) {
            for (const it of og.items || []) {
              const t = it.transaction_id ?? it.tx ?? it.transaction
              if (t) txs.push(String(t))
            }
          }
        } catch (e) {
          // ignore per-customer failures
        }
      }

      if (txs.length === 0) {
        // nothing to do, just close
        setBatchCompleteOpen(false)
        onOpenChange(false)
        return
      }

      // call RPC via service
      try {
        await bulkMoveToPendingToShip(txs)
      } catch (e) {
        console.error('RPC bulk_move_to_pending_to_ship failed', e)
      }
    } catch (e) {
      console.error('handleBatchCompleteConfirm failed', e)
    } finally {
      setBatchCompleteOpen(false)
      onOpenChange(false)
    }
  }

  // handleConfirmAdvanceNow removed — auto-advance will proceed automatically after countdown

  // Removed bulk confirm handler (button removed per request)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs h-[100vh]"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-[90vw] max-w-[400px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-auto">
       

        {/* Header */}
        <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
          <div className=" text-sm text-gray-600">打包執貨</div>
          <button
            aria-label="close"
            onClick={() => onOpenChange(false)}
            className="text-gray-500 absolute right-4 top-4"
          >
            <Lucide.X />
          </button>
        </div>

        <div className="px-6 pb-4 border-b flex-col items-center">
          <div className="flex items-center gap-2 justify-center w-full">
            <div className="w-8 flex items-center justify-center">
              {bulkData.length > 1 && currentIndex > 0 ? (
                <button
                  aria-label="previous customer"
                  onClick={() => {
                    const ni = Math.max(0, currentIndex - 1)
                    _manualNavRef.current = ni
                    _lastChangeBySwipeRef.current = false
                    setCurrentIndex(ni)
                  }}
                  disabled={loading}
                  className="p-1 text-gray-500 disabled:opacity-40"
                >
                  <Lucide.ChevronLeft />
                </button>
              ) : null}
            </div>

            <div className="flex-1 text-center">
              <div className="text-xs text-gray-500">
                {loading ? "載入中…" : `第 ${bulkData.length > 0 ? currentIndex + 1 : 0}/${bulkData.length} 位顧客`}
              </div>
            </div>

            <div className="w-8 flex items-center justify-center">
              {bulkData.length > 1 && currentIndex < bulkData.length - 1 ? (
                <button
                  aria-label="next customer"
                  onClick={() => {
                    const ni = Math.min(bulkData.length - 1, currentIndex + 1)
                    _manualNavRef.current = ni
                    _lastChangeBySwipeRef.current = false
                    setCurrentIndex(ni)
                  }}
                  disabled={loading}
                  className="p-1 text-gray-500 disabled:opacity-40"
                >
                  <Lucide.ChevronRight />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 justify-center">
            <div className="text-lg font-semibold">
              {bulkData[currentIndex]?.customer_info.customer_name ?? "—"}
            </div>
            <div className="text-lg font-semibold text-gray-700">|</div>
            <div className="text-lg font-semibold">{bulkData[currentIndex]?.customer_info.phone ?? "—"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[100%]">
          
          {/* Summary row */}
          <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="">交易編號</div>
                  <div className="">{(function(){
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
              <div className="text-xs text-gray-700">共 {extractedOrderGroups.length} 張訂單 | {totalQuantity} 件商品</div>
              <div className="text-md font-semibold">總額 ${totalAmount.toLocaleString()}</div>
            </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="text-xs text-gray-500">{/* transaction id placeholder */}</div>
                {/* Confirm pack button: marks all items for current customer as pre_pending_to_ship */}
                {allItemsPrePending ? (
                  <button
                    className="px-3 py-1 rounded-full bg-primary text-white text-sm"
                    onClick={async () => {
                    try {
                      setLoading(true)
                      const b = bulkData[currentIndex]
                      if (!b) return
                      const txs: string[] = []
                      const orders = Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
                      for (const og of orders) {
                        for (const it of og.items || []) {
                          const t = it.transaction_id ?? it.tx ?? it.transaction ?? null
                          if (t) txs.push(String(t))
                        }
                      }

                      if (txs.length === 0) return

                      // Optimistically update UI to pending_to_ship for this customer
                      setBulkData((prev) => {
                        return prev.map((cust, idx) => {
                          if (idx !== currentIndex) return cust
                          try {
                            const byStatus = cust.orders_by_status || {}
                            const nextByStatus: Record<string, any> = {}
                            Object.entries(byStatus).forEach(([k, v]: any) => {
                              const orders = (v?.orders || []).map((og: any) => ({
                                ...og,
                                items: (og.items || []).map((it: any) => {
                                  const tx = it.transaction_id ?? it.tx ?? it.transaction ?? null
                                  if (tx && txs.includes(String(tx))) return { ...it, status: 'pending_to_ship' }
                                  return it
                                }),
                              }))
                              nextByStatus[k] = { ...(v || {}), orders }
                            })
                            return { ...cust, orders_by_status: nextByStatus }
                          } catch (e) {
                            return cust
                          }
                        })
                      })

                      // Call bulk RPC
                      try {
                        await bulkMoveToPendingToShip(txs)
                      } catch (err) {
                        console.error('bulk_move_to_pending_to_ship failed', err)
                      }
                    } catch (e) {
                      console.error('confirm pack failed', e)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  確認打包
                </button>
                ) : null}
              </div>
          </div>

          {/* Progress bar: show bulk processing progress */}
          <div className="mt-4">
            {/* Progress bar now shows proportion of items with status = 'pre_pending_to_ship' */}
            <div className="text-xs text-gray-600 mb-2">
              {bulkData.length > 0 ? `待出貨項目： ${preCount}/${totalCount}` : '尚無顧客'}
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div
                className="bg-emerald-500 h-2 rounded"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-2 text-center">向右掃標示商品已打包</div>
          </div>

          

          {/* Orders list (always expanded) */}

          <div className="space-y-3 mt-1">
              {extractedOrderGroups.length === 0 ? (
              <div className="text-sm text-gray-500">{loading ? '載入中…' : '沒有選取任何訂單'}</div>
            ) : (
              extractedOrderGroups.map((og, ogIdx) => (
                <OrderCard
                  key={og.order_number ?? String(ogIdx)}
                  order={og}
                  className="bg-white rounded-xl shadow max-h-[85vh] overflow-hidden"
                  onItemStatusChange={handleItemStatusChange}
                  overlays={overlaysByOrder[og.order_number ?? String(ogIdx)]}
                  onOverlaysChange={(ov) => setOverlaysByOrder((prev) => ({ ...prev, [og.order_number ?? String(ogIdx)]: { ...(prev[og.order_number ?? String(ogIdx)] || {}), ...ov } }))}
                />
              ))
            )}
          </div>

         

          {/* Action row (controls moved elsewhere) */}

          {/* Pending auto-advance dialog with Undo/Continue */}
          {pendingAdvance ? (
            <div className="fixed inset-0 z-60 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative bg-white rounded-xl shadow-lg p-6 w-[90vw] max-w-[400px] z-70 text-center">
                <div className="text-lg font-semibold mb-2">正在切換下位顧客</div>
                <div className="text-4xl font-bold text-gray-800 my-4">{countdownSec}</div>
                <div className="text-sm text-gray-500 mb-4">秒</div>
                <div className="flex justify-center">
                  <button
                    className="px-6 py-2 rounded bg-red-600 text-white text-sm"
                    onClick={handleCancelPending}
                  >
                    取消切換
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
                    onClick={handleBatchCompleteConfirm}
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

