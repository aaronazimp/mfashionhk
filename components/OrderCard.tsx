"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as Lucide from 'lucide-react'
import Image from 'next/image'

import type { OCItem, OCOrder } from '@/types/order'
import { cancelOrderItem, markOrderItemPrePendingToShip, markOrderItemVerified } from '@/lib/orderService'
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
  overlays?: { translates?: Record<string, string>; revealed?: Record<string, 'left' | 'right' | false> }
  onOverlaysChange?: (ov: { translates: Record<string, string>; revealed: Record<string, 'left' | 'right' | false> }) => void
}

export default function OrderCard({ order, className = '', compact = false, statusBadge, onItemStatusChange, overlays, onOverlaysChange }: Props) {
  const [items, setItems] = useState<OCItem[]>(order.items || [])
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const activeIndexRef = useRef<number | null>(null)
  const measuredWidthRef = useRef<Record<number, number>>({})
  const _overlaysLastAppliedRef = useRef<string | null>(null)
  const _overlaysLastSentRef = useRef<string | null>(null)
  const _skipNextNotifyRef = useRef<boolean>(false)
  const [translates, setTranslates] = useState<Record<number, string>>({})
  // revealed: 'right' | 'left' | false
  const [revealed, setRevealed] = useState<Record<number, 'right' | 'left' | false>>({})
  const _clearOverlayLastSentRef = useRef<string | null>(null)

  useEffect(() => {
    setItems(order.items || [])
  }, [order.items])

  // Initialize local overlay state from parent-provided overlays (keys use item index -> we map incoming string keys to indices by item_id)
  useEffect(() => {
    try {
      if (!overlays) return
      const t = {} as Record<number, string>
      const r = {} as Record<number, 'right' | 'left' | false>
      const mapIdToIndex = {} as Record<string, number>
      (order.items || []).forEach((it: any, i: number) => {
        const id = String(it.item_id ?? it.line_item_id ?? it.id ?? i)
        mapIdToIndex[id] = i
      })
      Object.entries(overlays.translates || {}).forEach(([k, v]) => {
        const idx = mapIdToIndex[String(k)]
        if (idx != null) t[idx] = v
      })
      Object.entries(overlays.revealed || {}).forEach(([k, v]) => {
        const idx = mapIdToIndex[String(k)]
        if (idx != null) r[idx] = v as any
      })
      // Only apply overlays if they differ from last applied to avoid update loops
      const payload = { t, r }
      const payloadStr = JSON.stringify(payload)
      if (_overlaysLastAppliedRef.current === payloadStr) return
      _overlaysLastAppliedRef.current = payloadStr
      // when applying overlays from parent, skip notifying parent back immediately
      _skipNextNotifyRef.current = true
      if (Object.keys(t).length) setTranslates((s) => {
        // avoid setting state if values are identical
        const merged = { ...s, ...t }
        const mergedStr = JSON.stringify(merged)
        const sStr = JSON.stringify(s)
        return mergedStr === sStr ? s : merged
      })
      if (Object.keys(r).length) setRevealed((s) => {
        const merged = { ...s, ...r }
        const mergedStr = JSON.stringify(merged)
        const sStr = JSON.stringify(s)
        return mergedStr === sStr ? s : merged
      })
    } catch (e) {
      // ignore
    }
  }, [overlays?.translates, overlays?.revealed, order.items])

  // Notify parent when local overlay state changes (parent can persist it keyed by order + item id)
  useEffect(() => {
    try {
      if (!onOverlaysChange) return
      const outTrans = {} as Record<string, string>
      const outRev = {} as Record<string, 'left' | 'right' | false>
      (order.items || []).forEach((it: any, i: number) => {
        const id = String(it.item_id ?? it.line_item_id ?? it.id ?? i)
        if (translates[i] != null) outTrans[id] = translates[i]
        if (revealed[i] != null) outRev[id] = revealed[i]
      })
      // avoid calling parent if payload is unchanged to prevent update loops
      const payload = { translates: outTrans, revealed: outRev }
      const payloadStr = JSON.stringify(payload)
      if (_skipNextNotifyRef.current) {
        _skipNextNotifyRef.current = false
        _overlaysLastSentRef.current = payloadStr
      } else if (_overlaysLastSentRef.current !== payloadStr) {
        _overlaysLastSentRef.current = payloadStr
        onOverlaysChange(payload)
      }
    } catch (e) {
      // ignore
    }
  }, [translates, revealed, onOverlaysChange, order.items])

  // Ensure that when an item's status becomes 'verified' or 'cancelled' we
  // clear any local overlay state for that item and notify the parent so the
  // persisted overlays won't be re-applied.
  useEffect(() => {
    try {
      if (!Array.isArray(items) || items.length === 0) return
      const toClearIdxs: number[] = []
      items.forEach((it: any, i: number) => {
        const s = String(it.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
        if (s === 'verified' || s === 'cancelled' || s === 'void') {
          // if currently revealed or translated, mark to clear
          const t = translates[i]
          const r = revealed[i]
          if ((typeof t === 'string' && t !== '0px') || (r !== undefined && r !== false)) toClearIdxs.push(i)
        }
      })
      if (toClearIdxs.length === 0) return

      // build new local state with cleared entries
      const newTrans = { ...(translates || {}) }
      const newRev = { ...(revealed || {}) }
      toClearIdxs.forEach((i) => {
        newTrans[i] = '0px'
        newRev[i] = false
      })
      setTranslates(newTrans)
      setRevealed(newRev)

      // notify parent of overlays trimmed for this order
      if (onOverlaysChange) {
        const outTrans = {} as Record<string, string>
        const outRev = {} as Record<string, any>
        ;(order.items || []).forEach((it: any, i: number) => {
          const id = String(it.item_id ?? it.line_item_id ?? it.id ?? i)
          if (newTrans[i] != null) outTrans[id] = newTrans[i]
          if (newRev[i] != null) outRev[id] = newRev[i]
        })
        const payload = { translates: outTrans, revealed: outRev }
        const payloadStr = JSON.stringify(payload)
        if (_clearOverlayLastSentRef.current !== payloadStr) {
          _clearOverlayLastSentRef.current = payloadStr
          try {
            onOverlaysChange(payload)
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, [items])

  function handlePointerDown(e: React.PointerEvent, idx: number) {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    activeIndexRef.current = idx
    try {
      // measure row width for threshold calculations
      const w = (e.currentTarget as HTMLElement).getBoundingClientRect().width
      measuredWidthRef.current[idx] = w
    } catch (err) {
      // ignore
    }

    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } catch (err) {
      // ignore
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const startX = startXRef.current
    const startY = startYRef.current
    const idx = activeIndexRef.current
    if (startX == null || idx == null) return
    const deltaX = e.clientX - startX
    const deltaY = startY == null ? 0 : e.clientY - startY

    // If the gesture is primarily vertical, ignore so page scroll isn't interfered with
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) return

    // allow swipe across the full measured width (clamped)
    const measured = measuredWidthRef.current[idx] ?? 300

    // If the underlying item is already in a "pre_pending_to_ship" state
    // we render the left overlay via `isPrePendingToShip`. Treat that as
    // a revealed-left state for gesture handling so users can't accidentally
    // open the opposite (right) overlay while the item is effectively revealed.
    try {
      const it = items[idx]
      const s = String((it as any)?.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
      const isPrePendingToShip = s === 'prependingtoship'
      if (isPrePendingToShip) {
        // behave like `revealed[idx] === 'left'` branch: allow closing (leftwards drag)
        if (deltaX <= 0) {
          const pct = Math.min(100, Math.max(0, 100 + (deltaX / measured) * 100))
          setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
        } else {
          const pct = Math.max(0, Math.min(100, (Math.min(measured, deltaX) / measured) * 100))
          setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
        }
        return
      }
    } catch (e) {
      // ignore
    }

    // If currently revealed to the right, a positive deltaX should progressively close the overlay
    if (String(revealed[idx]) === 'right') {
      if (deltaX >= 0) {
        const pct = Math.max(-100, Math.min(0, -100 + (deltaX / measured) * 100))
        setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
      } else {
        // continue expanding (more negative)
        const pct = Math.max(-100, Math.min(0, (Math.max(-measured, deltaX) / measured) * 100))
        setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
      }
      return
    }

    // If currently revealed to the left, a negative deltaX should progressively close the left overlay
    if (String(revealed[idx]) === 'left') {
      if (deltaX <= 0) {
        const pct = Math.min(100, Math.max(0, 100 + (deltaX / measured) * 100))
        setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
      } else {
        const pct = Math.max(0, Math.min(100, (Math.min(measured, deltaX) / measured) * 100))
        setTranslates((s) => ({ ...s, [idx]: `${pct}%` }))
      }
      return
    }

    // Determine whether this item is allowed to be swiped rightwards (open left overlay)
    // and whether leftward swipes (reveal right overlay / cancel) are permitted.
    let isVerified = false
    let allowRightToLeft = false
    try {
      const it = items[idx]
      const s = String((it as any)?.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
      isVerified = s === 'verified'
      allowRightToLeft = s === 'waitlist' || s === 'confirmed'
    } catch (e) {
      // ignore
    }

    if (deltaX < 0) {
      // only allow leftward drags (reveal right overlay) if status permits
      if (!allowRightToLeft) return
      const tx = Math.max(deltaX, -measured)
      setTranslates((s) => ({ ...s, [idx]: `${tx}px` }))
    } else if (deltaX > 0) {
      // Only allow rightward movement (revealing the left overlay) when the
      // item is currently `verified`. Otherwise ignore rightward drags so the
      // action can't be revealed.
      if (isVerified) {
        const tx = Math.min(deltaX, measured)
        setTranslates((s) => ({ ...s, [idx]: `${tx}px` }))
      }
    }
  }

  async function handlePointerUp(e: React.PointerEvent) {
    const startX = startXRef.current
    const startY = startYRef.current
    const idx = activeIndexRef.current
    if (startX == null || idx == null) {
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    const deltaX = e.clientX - startX
    const deltaY = startY == null ? 0 : e.clientY - startY

    // If gesture was mostly vertical, cancel swipe behavior
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      setTranslates((s) => ({ ...s, [idx]: '0px' }))
      setRevealed((s) => ({ ...s, [idx]: false }))
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    // If overlay is currently revealed to the right, allow swipe-back (rightwards
    // deltaX) to close it quickly with a small threshold.
    if (String(revealed[idx]) === 'right') {
      if (deltaX > 40) {
        setTranslates((s) => ({ ...s, [idx]: '0px' }))
        setRevealed((s) => ({ ...s, [idx]: false }))
        // inform parent to clear persisted overlays for this item so it doesn't get re-applied
        if (onOverlaysChange) {
          Promise.resolve().then(() => {
            try {
              const outTrans = {} as Record<string, string>
              const outRev = {} as Record<string, any>
              ;(order.items || []).forEach((it: any, i: number) => {
                const id = String(it.item_id ?? it.line_item_id ?? it.id ?? i)
                if (i === idx) return
                if (translates[i] != null) outTrans[id] = translates[i]
                if (revealed[i] != null) outRev[id] = revealed[i]
              })
              onOverlaysChange({ translates: outTrans, revealed: outRev })
            } catch (e) {
              // ignore
            }
          })
        }
        startXRef.current = null
        startYRef.current = null
        activeIndexRef.current = null
        return
      }
      // If user didn't swipe back enough, keep it revealed
      setTranslates((s) => ({ ...s, [idx]: '-100%' }))
      setRevealed((s) => ({ ...s, [idx]: 'right' }))
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    // If overlay is currently revealed to the left, allow swipe-back (leftwards
    // deltaX) to close it quickly with a small threshold.
    // consider items already marked `pre_pending_to_ship` as effectively revealed-left
    const _it = items[idx]
    const _s = String((_it as any)?.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
    const _isPrePendingToShip = _s === 'prependingtoship'
    if (String(revealed[idx]) === 'left' || _isPrePendingToShip) {
      // user must drag left (negative deltaX) to close
      if (deltaX < -40) {
        // update local state and DB to mark as 'verified'
          try {
            const it = items[idx]
            // prefer the DB primary `id` field, fallback to `item_id` or `line_item_id`
            const derivedId = (it as any)?.id ?? (it as any)?.item_id ?? (it as any)?.line_item_id ?? null
          const idStr = derivedId ? String(derivedId) : null
          // reflect verified status locally immediately
          setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, status: 'verified' } : p)))
          try {
            if (idStr) {
              onItemStatusChange?.(idStr, 'verified', { source: 'swipe' })
            }
          } catch (e) {
            // ignore
          }
          if (idStr) {
            markOrderItemVerified(String(idStr)).catch((err) => console.error('mark verified failed', err))
          } else {
          }
        } catch (e) {
          // ignore
        }
        setTranslates((s) => ({ ...s, [idx]: '0px' }))
        setRevealed((s) => ({ ...s, [idx]: false }))
        startXRef.current = null
        startYRef.current = null
        activeIndexRef.current = null
        return
      }
      // keep left revealed
      setTranslates((s) => ({ ...s, [idx]: '70%' }))
      setRevealed((s) => ({ ...s, [idx]: 'left' }))
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    // If an overlay is already revealed (or the item is pre_pending_to_ship),
    // don't allow opening the opposite overlay here. Snap back to the revealed state
    // instead of toggling sides.
    // Snap back to the revealed state instead of toggling sides.
    if (revealed[idx] || _isPrePendingToShip) {
      if (String(revealed[idx]) === 'right') {
        setTranslates((s) => ({ ...s, [idx]: '-100%' }))
        setRevealed((s) => ({ ...s, [idx]: 'right' }))
      } else {
        // default to left visual state
        setTranslates((s) => ({ ...s, [idx]: '70%' }))
        setRevealed((s) => ({ ...s, [idx]: 'left' }))
      }
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    // determine the width of the swiped element
    const width = measuredWidthRef.current[idx] ?? ((e.currentTarget as HTMLElement).getBoundingClientRect().width || 0)

    // require larger swipe: 70% of width or minimum 80px
    const required = Math.max(width * 0.7, 80)

    // Determine whether rightward swipe (open left overlay) is allowed for this item
    let isVerified = false
    try {
      const itCheck = items[idx]
      const sCheck = String((itCheck as any)?.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
      isVerified = sCheck === 'verified'
    } catch (e) {
      // ignore
    }

    // Determine whether leftward swipe (reveal right overlay / cancel) is allowed
    let allowRightToLeft = false
    try {
      const itCheck2 = items[idx]
      const sCheck2 = String((itCheck2 as any)?.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
      allowRightToLeft = sCheck2 === 'waitlist' || sCheck2 === 'confirmed'
    } catch (e) {
      // ignore
    }

    // If user attempted a leftward swipe but it's not allowed, snap back
    if (deltaX < 0 && !allowRightToLeft) {
      setTranslates((s) => ({ ...s, [idx]: '0px' }))
      setRevealed((s) => ({ ...s, [idx]: false }))
      startXRef.current = null
      startYRef.current = null
      activeIndexRef.current = null
      return
    }

    // If user swiped more than required, reveal the action overlay (do NOT auto-cancel)
    if (deltaX < 0 && Math.abs(deltaX) > required) {
      // reveal action overlay (100%) on the right — user must tap the button to cancel
      setTranslates((s) => ({ ...s, [idx]: '-100%' }))
      setRevealed((s) => ({ ...s, [idx]: 'right' }))
    } else if (deltaX < -60) {
      // partial reveal right — snap to 100% as visual affordance
      setTranslates((s) => ({ ...s, [idx]: '-100%' }))
      setRevealed((s) => ({ ...s, [idx]: 'right' }))
    } else if (deltaX > 0 && deltaX > required) {
      if (isVerified) {
        setTranslates((s) => ({ ...s, [idx]: '70%' }))
        setRevealed((s) => ({ ...s, [idx]: 'left' }))

        // optimistic local update: set this item's status to pre_pending_to_ship
        try {
          const it = items[idx]
          // prefer the DB primary `id` field, fallback to `item_id` or `line_item_id`
          const id = (it as any)?.id ?? (it as any)?.item_id ?? (it as any)?.line_item_id
          if (id) {
            setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, status: 'pre_pending_to_ship' } : p)))
            // notify parent about optimistic status change (from swipe)
            try {
              onItemStatusChange?.(String(id), 'pre_pending_to_ship', { source: 'swipe' })
            } catch (e) {
              // ignore
            }
            // fire-and-forget server update; log errors but don't block UI
            markOrderItemPrePendingToShip(String(id)).catch((err) => console.error('mark pre_pending_to_ship failed', err))
          }
        } catch (e) {
          console.error('optimistic pre_pending_to_ship update failed', e)
        }
      } else {
        // not allowed to reveal left overlay for non-verified items; snap back
        setTranslates((s) => ({ ...s, [idx]: '0px' }))
        setRevealed((s) => ({ ...s, [idx]: false }))
      }
    } else if (deltaX > 60) {
      if (isVerified) {
        setTranslates((s) => ({ ...s, [idx]: '70%' }))
        setRevealed((s) => ({ ...s, [idx]: 'left' }))
      } else {
        setTranslates((s) => ({ ...s, [idx]: '0px' }))
        setRevealed((s) => ({ ...s, [idx]: false }))
      }
    } else {
      // snap back
      setTranslates((s) => ({ ...s, [idx]: '0px' }))
      setRevealed((s) => ({ ...s, [idx]: false }))
    }

    startXRef.current = null
    startYRef.current = null
    activeIndexRef.current = null
  }

  async function handleCancelItem(it: OCItem, idx: number) {
    const id = (it as any).item_id ?? (it as any).id
    if (!id) return
    const idStr = String(id)
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, status: 'cancelled', remark: '管理員手動取消' } : p)))
    try {
      onItemStatusChange?.(idStr, 'cancelled')
    } catch (e) {
      // ignore
    }
    try {
      await cancelOrderItem(String(id))
    } catch (err) {
      console.error('Failed to cancel item', err)
    }
    // Schedule a targeted refresh for this item after suppression ends so
    // the parent updates. Use a per-id timer to avoid stomping other timers.
    if (typeof window !== 'undefined') {
      try {
        const delay = 3200 // slightly longer than suppression (3000ms)
        const timerKey = `__ordersRefreshTimer_${idStr}`
        if ((window as any)[timerKey]) {
          clearTimeout((window as any)[timerKey])
        }
        ;(window as any)[timerKey] = setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('orders:refresh', { detail: { source: 'local-scheduled', id: idStr } }))
          } catch (e) {
            console.warn('scheduled orders:refresh dispatch failed', e)
          }
          ;(window as any)[timerKey] = null
        }, delay)
      } catch (e) {
        // ignore scheduling errors
      }
    }

    setTranslates((s) => ({ ...s, [idx]: '0px' }))
    setRevealed((s) => ({ ...s, [idx]: false }))
    // inform parent to clear persisted overlays for this item
    if (onOverlaysChange) {
      try {
        const outTrans = {} as Record<string, string>
        const outRev = {} as Record<string, any>
        (order.items || []).forEach((it2: any, i: number) => {
          const id = String(it2.item_id ?? it2.line_item_id ?? it2.id ?? i)
          if (i === idx) return
          if (translates[i] != null) outTrans[id] = translates[i]
          if (revealed[i] != null) outRev[id] = revealed[i]
        })
        onOverlaysChange({ translates: outTrans, revealed: outRev })
      } catch (e) {
        // ignore
      }
    }
  }

  function overlayWidth(idx: number) {
    try {
      const tx = translates[idx] ?? '0px'
      if (typeof tx === 'string' && tx.trim().endsWith('%')) {
        // translate values may be stored as '-70%'; normalize to positive percentage
        const raw = tx.trim().replace('%', '')
        const asNum = Math.min(100, Math.max(0, Math.abs(Number(raw) || 0)))
        return `${asNum}%`
      }
      const px = parseFloat(String(tx)) || 0
      const w = measuredWidthRef.current[idx] ?? 300
      const pct = Math.min(100, Math.round((Math.min(Math.abs(px), w) / Math.max(1, w)) * 100))
      return `${pct}%`
    } catch (e) {
      return '0%'
    }
  }

  function overlayWidthForSide(idx: number, side: 'left' | 'right') {
    try {
      const tx = translates[idx] ?? '0px'
      // If fully revealed state, return 100% for that side only
      if (String(revealed[idx]) === 'right') return side === 'right' ? '100%' : '0%'
      if (String(revealed[idx]) === 'left') return side === 'left' ? '100%' : '0%'

      if (typeof tx === 'string' && tx.trim().endsWith('%')) {
        const raw = Number(tx.trim().replace('%', '')) || 0
        if (side === 'right') {
          return raw < 0 ? `${Math.min(100, Math.abs(raw))}%` : '0%'
        }
        return raw > 0 ? `${Math.min(100, raw)}%` : '0%'
      }

      const px = parseFloat(String(tx)) || 0
      const w = measuredWidthRef.current[idx] ?? 300
      const pct = Math.min(100, Math.round((Math.min(Math.abs(px), w) / Math.max(1, w)) * 100))
      if (side === 'right') return px < 0 ? `${pct}%` : '0%'
      return px > 0 ? `${pct}%` : '0%'
    } catch (e) {
      return '0%'
    }
  }

  const hasShippedUI = (items || []).some((it) => {
    const s = String(it.status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
    return s === 'shipped'
  })

  return (
    <div className={`w-[325px] relative rounded-2xl overflow-hidden shadow-sm mx-auto self-start ${className}`}>
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
      {order.order_number ? <div className="bg-primary text-center text-xs text-white py-2">訂單# {order.order_number}</div> : null}
      <div className="bg-white p-4 space-y-4 border-t border-gray-100 max-h-96 overflow-y-auto">
          {(items || []).map((it, idx) => {
          const isLast = idx === (items || []).length - 1
          const isCanceled = String(it.status || '').toLowerCase().trim() === 'void' || String(it.status || '').toLowerCase().trim() === 'cancelled'
          const tx = translates[idx] ?? '0px'

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
               

                {/* Overlay (grows from right) sits above the item; item remains unmoved */}
                <div className="absolute inset-0 right-0 z-10 flex items-center justify-end pointer-events-none">
                  <div
                    className={`h-full flex items-center justify-center transition-all duration-150 rounded-lg overflow-hidden`}
                    style={{
                      width: String(revealed[idx]) === 'right' ? '100%' : overlayWidthForSide(idx, 'right'),
                      backgroundColor: 'rgba(220,38,38,0.89)',
                      pointerEvents: 'none',
                      transformOrigin: 'right center',
                    }}
                  >
                    <div className={`flex flex-col items-center gap-1 ${String(revealed[idx]) === 'right' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                      <button
                        aria-hidden={revealed[idx] !== 'right'}
                        className="w-12 h-10  text-white flex items-center justify-center "
                        onClick={() => handleCancelItem(it, idx)}
                      >
                        <Lucide.Trash2 size={16} />
                      </button>
                      <div className={`text-xs text-white transition-opacity duration-150 ${String(revealed[idx]) === 'right' ? 'opacity-100' : 'opacity-0'}`}>取消訂單?</div>
                    </div>
                  </div>
                </div>
                
                {/* Left overlay (packed) */}
                <div className="absolute inset-0 left-0 z-10 flex items-center justify-start pointer-events-none">
                  <div
                    className={`h-full flex items-center justify-center transition-all duration-150 rounded-lg overflow-hidden`}
                    style={{
                      // If fully revealed by gesture, occupy full width. If the
                      // item is already `pre_pending_to_ship`, render a smaller
                      // left overlay so the item details remain visible instead
                      // of being fully covered.
                      width: String(revealed[idx]) === 'left' ? '100%' : (isPrePendingToShip ? '28%' : overlayWidthForSide(idx, 'left')),
                      backgroundColor: 'rgba(16,185,129,0.89)',
                      pointerEvents: 'none',
                      transformOrigin: 'left center',
                    }}
                  >
                    <div className={`flex flex-col items-center gap-1 ${(String(revealed[idx]) === 'left' || isPrePendingToShip) ? '' : 'pointer-events-none'}`}>
                      <div className={`transition-opacity duration-150 ${(String(revealed[idx]) === 'left' || isPrePendingToShip) ? 'opacity-100' : 'opacity-0'}`}>
                        <Lucide.Check size={18} className="text-white" />
                      </div>
                      <div className={`text-xs text-white font-bold transition-opacity duration-150 ${(String(revealed[idx]) === 'left' || isPrePendingToShip) ? 'opacity-100' : 'opacity-0'}`}>已打包</div>
                    </div>
                  </div>
                </div>

               
                

                <div
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{ touchAction: 'pan-y' as any }}
                >
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
                        <div className={`flex flex-col items-start gap-1 ${String(revealed[idx]) === 'right' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
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
