"use client"

import React from "react"
import * as Lucide from "lucide-react"
import OrderCard from "../OrderCard"
import { fetchBulkCustomerOrders, bulkMarkAsShipped } from "../../lib/orderService"
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
  const initialBulkDataRef = React.useRef<ActiveCustomerRecords[] | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  // progress state removed; totals are computed on-demand where needed

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
      initialBulkDataRef.current = null
      // reset ephemeral UI state when modal closed
      try {
        setLoading(false)
        setToastMessage(null)
        setBatchCompleteOpen(false)
        setPendingAdvance(null)
        setCountdownSec(0)
        setOverlaysByOrder({})
        setOrdersExpanded(true)
        _autoTriggeredRef.current = null
        _justAutoAdvancedToRef.current = null
        _manualNavRef.current = null
        _lastChangeBySwipeRef.current = false
        _autoAdvancedForIndexRef.current = null
        _lastAutoTriggerIndexRef.current = null
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
            // capture initial snapshot when modal first loads
            if (!initialBulkDataRef.current) initialBulkDataRef.current = data
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
    const displayed = initialBulkDataRef.current ?? bulkData
    setCurrentIndex((ci) => (displayed.length === 0 ? 0 : Math.min(ci, displayed.length - 1)))
  }, [bulkData])

  // Handle item status changes from child OrderCard (optimistic updates)
  function handleItemStatusChange(itemId: string, newStatus: string, meta?: { source?: string }) {
    try {
      // record whether this status change originated from a swipe gesture
      _lastChangeBySwipeRef.current = meta?.source === 'swipe'
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
        return next
      })

      
    } catch (e) {
      console.warn('handleItemStatusChange failed', e)
    }
  }

  // progress counters removed — totals are computed on-demand where needed.

  // (removed automatic extraction of transaction ids from bulkData)

  const extractedOrderGroups = useMemo(() => {
    // Show orders for the selected customer only. Use initial snapshot (if present)
    const displayed = initialBulkDataRef.current ?? bulkData
    const b = displayed[currentIndex]
    const groups = b ? Object.values(b.orders_by_status).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? [])) : []

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
  const totalQuantity = useMemo(() => {
    return extractedOrderGroups.reduce((sum: number, og: any) => {
      const itemsQty = (og.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
      return sum + itemsQty
    }, 0)
  }, [extractedOrderGroups])
  
  
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const displayedBulkData = initialBulkDataRef.current ?? bulkData
  const currentCustomerId = displayedBulkData[currentIndex]?.customer_info?.customer_id ?? null
  const currentCustomerHasShipped = ((): boolean => {
    try {
      const b = displayedBulkData[currentIndex]
      if (!b) return false
      const orders = Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
        for (const og of orders) {
        for (const it of og.items || []) {
          const s = String(it.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
          if (s === 'shipped') return true
        }
      }
    } catch (e) {
      // ignore
    }
    return false
  })()
  const [ordersExpanded, setOrdersExpanded] = useState<boolean>(true)
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
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

      // compute totals for current customer on-demand
      const currentTotals = (function () {
        try {
          const b = bulkData[currentIndex]
          if (!b) return { pre: 0, total: 0 }
          return (Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? [])).reduce(
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
          ))
        } catch (e) {
          return { pre: 0, total: 0 }
        }
      })()

      if (currentTotals.total <= 0) return
      if (currentTotals.pre < currentTotals.total) return
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
        const cid = displayedBulkData[currentIndex]?.customer_info?.customer_id ?? ''
        setPendingAdvance({ fromIndex: currentIndex, toIndex: nextIndex, customerId: cid, timerId: Number(timer), timeoutMs: delay, isAllDone: allDone, startAt: Date.now() } as any)
      } catch (e) {
        setPendingAdvance(null)
      }
    } catch (e) {
      // ignore
    }
  }, [currentIndex, bulkData])

  // auto-clear toast messages
  useEffect(() => {
    if (!toastMessage) return
    const id = window.setTimeout(() => setToastMessage(null), 2500)
    return () => window.clearTimeout(id)
  }, [toastMessage])

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

  // (removed handleRevert — server-side revert RPC is no longer used here)

  // Mark current customer's transactions as shipped using new RPC
  async function handleCompleteShipment() {
    setLoading(true)
    try {
      const txs: string[] = []
      const b = displayedBulkData[currentIndex] ?? bulkData[currentIndex]
      if (!b) return
      const orders = Object.values(b.orders_by_status || {}).flatMap((s: any) => (Array.isArray(s) ? s : s?.orders ?? []))
      for (const og of orders) {
        for (const it of og.items || []) {
          const t = it.transaction_id ?? it.tx ?? it.transaction
          if (t) txs.push(String(t))
        }
      }

      if (txs.length === 0) {
        setToastMessage('此顧客沒有可標記的交易編號')
        return
      }

      try {
        await bulkMarkAsShipped(txs)
      } catch (e) {
        console.error('RPC bulk_mark_as_shipped failed', e)
        setToastMessage('完成寄貨失敗')
        return
      }

      // refresh snapshot for current active customers
      let refreshed: ActiveCustomerRecords[] | null = null
      try {
        const ids = activeCustomerIds ?? []
        if (ids.length) {
          refreshed = await fetchBulkCustomerOrders(ids, statusFilter)
          setBulkData(refreshed)
        }
      } catch (e) {
        console.warn('Failed to refresh after marking shipped', e)
      }

      // update preserved snapshot (UI-only) so previously-shipped orders show updated status when navigating back
      try {
        const txSet = new Set(txs)
        const snap = initialBulkDataRef.current ?? bulkData
        const updatedSnap = (snap || []).map((cust) => {
          try {
            const byStatus = cust.orders_by_status || {}
            const nextByStatus: Record<string, any> = {}
            Object.entries(byStatus).forEach(([k, v]: any) => {
              const orders = (v?.orders || []).map((og: any) => ({
                ...og,
                items: (og.items || []).map((it: any) => {
                  const t = it.transaction_id ?? it.tx ?? it.transaction
                  if (t && txSet.has(String(t))) return { ...it, status: 'pending_to_ship' }
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
        initialBulkDataRef.current = updatedSnap
        setBulkData((s) => (s ? [...s] : s))
      } catch (e) {
        // ignore snapshot update errors
      }

      // compute per-customer totals from refreshed data (or existing bulkData)
      try {
        const dataForTotals = refreshed ?? bulkData
        const len = dataForTotals.length
        const customerTotals = dataForTotals.map((b) => {
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
        if (allDone) {
          setBatchCompleteOpen(true)
          setToastMessage('已完成寄貨')
          return
        }

        // find next customer index with remaining items
        let nextIndex: number | null = null
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

        if (nextIndex != null) {
          _justAutoAdvancedToRef.current = nextIndex
          setCurrentIndex(nextIndex)
          setToastMessage('已完成寄貨')
        } else {
          setBatchCompleteOpen(true)
          setToastMessage('已完成寄貨')
        }
      } catch (e) {
        // fallback: just show success toast and show completion dialog
        setToastMessage('已完成寄貨')
        setBatchCompleteOpen(true)
      }
    } catch (e) {
      console.error('handleCompleteShipment failed', e)
      setToastMessage('完成寄貨時發生錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function handleUndoAdvance() {
    if (!pendingAdvance) return
    try {
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
      // Refresh bulk data snapshot for current active customers (no server-side revert)
      try {
        const ids = activeCustomerIds ?? []
        if (ids.length) {
          const refreshed = await fetchBulkCustomerOrders(ids, statusFilter)
          setBulkData(refreshed)
        }
      } catch (e) {
        console.warn('Failed to refresh after undo', e)
      }
    } catch (e) {
      console.error('Undo refresh failed', e)
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
  // (removed handleBatchCompleteConfirm — bulk RPC moved out of this UI)

  // Mark current customer's transactions as pending_to_ship (shipped)
  // (removed handleMarkCurrentCustomerShipped — server-side bulk move RPC is no longer used here)

  // handleConfirmAdvanceNow removed — auto-advance will proceed automatically after countdown

  // Removed bulk confirm handler (button removed per request)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs h-[100vh]" />

      <div className="relative w-full max-w-[400px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-auto">
       

        {/* Header */}
        <div className="px-6 pt-4 pb-2 flex items-start justify-center mb-4">
          <div className=" text-xs text-gray-600">寄貨明細</div>
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
              {displayedBulkData.length > 1 && currentIndex > 0 ? (
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
              {displayedBulkData.length > 1 && currentIndex < displayedBulkData.length - 1 ? (
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
            <div className="text-xs font-semibold">
              {displayedBulkData[currentIndex]?.customer_info.customer_name ?? "—"}
            </div>
            <div className="text-xs font-semibold text-gray-700">|</div>
            <div className="text-xs font-semibold">{displayedBulkData[currentIndex]?.customer_info.phone ?? "—"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[100%]">
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
              <div className="text-xs text-gray-700">共 {extractedOrderGroups.length} 張訂單 | {totalQuantity} 件商品</div>
              <div className="text-xs font-semibold">總額 ${totalAmount.toLocaleString()}</div>
            </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="text-xs text-gray-500 mr-3">{/* transaction id placeholder */}</div>
                {!currentCustomerHasShipped ? (
                  <button
                    className="px-3 py-1 rounded-full bg-primary text-white text-sm"
                    onClick={() => handleCompleteShipment()}
                    disabled={loading}
                  >
                    完成寄貨
                  </button>
                ) : null}
              </div>
          </div>

          {/* progress UI removed */}

          

          {/* Orders list (always expanded) */}

          <div className="space-y-3 mt-3">
              {extractedOrderGroups.length === 0 ? (
              <div className="text-sm text-gray-500">{loading ? '載入中…' : '沒有選取任何訂單'}</div>
            ) : (
              extractedOrderGroups.map((og, ogIdx) => (
                <OrderCard
                  key={og.order_number ?? String(ogIdx)}
                  order={og}
                  className="bg-white rounded-xl shadow max-h-96 overflow-hidden"
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
        {toastMessage ? (
          <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-60">
            <div className="px-4 py-2 bg-black text-white rounded">{toastMessage}</div>
          </div>
        ) : null}
      </div>
  )
}

