"use client"

import Link from 'next/link'
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getPaymentPageData } from '@/lib/orderService'
import { OrderStatusBadge } from './OrderCard'
import { Button } from './ui/button'
import type { Registration } from '@/lib/orders'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

type ActionType = 'confirm' | 'out-of-stock' | 'verify' | 'archive' | 'undo' | 'void' | 'resend' | 'force-pay' | 'mark-paid'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  initialItems: Registration[]
  initialSelectedItemId?: string
  title?: string
  product?: any
  onAction?: (r: Registration, type: ActionType, options?: any) => void
  formatTime?: (d: Date) => string
  transactionId?: string | null
}

// Status badges are rendered by shared `OrderStatusBadge` for consistency



// Safe date helpers to avoid runtime RangeError when timestamps are invalid
function toSafeDate(d: any): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return !isNaN(dt.getTime()) ? dt : null;
}

// helper to detect cancelled status values
function isCancelledStatus(status: any): boolean {
  if (status === null || status === undefined) return false
  try {
    const s = String(status).toLowerCase()
    return s.includes('cancel')
  } catch (e) {
    return false
  }
}

export default function OrderModal({ open, onOpenChange, sku, initialItems = [], initialSelectedItemId, title, product, onAction, formatTime, transactionId }: Props) {
  const [items, setItems] = useState<Registration[]>(initialItems)
  const lastNonEmptyItems = useRef<Registration[] | null>(initialItems && initialItems.length > 0 ? initialItems : null)
  const [subtotal, setSubtotal] = useState<number | null>(null)
  const [shippingFee, setShippingFee] = useState<number | null>(null)
  const [totalToPay, setTotalToPay] = useState<number | null>(null)
  const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null)
  const [topStatus, setTopStatus] = useState<string | null>(null)
  const [txnId, setTxnId] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [whatsappContact, setWhatsappContact] = useState<string | null>(null)
  const [topCustomerName, setTopCustomerName] = useState<string | null>(null)
  const [showOtherItems, setShowOtherItems] = useState<boolean>(false)
  const [packedIds, setPackedIds] = useState<string[]>([])
  const [isPacking, setIsPacking] = useState<boolean>(false)
  const lastNonEmptyInCurrentTxn = useRef<Registration[] | null>(null)

  useEffect(() => {
    // Always sync items from parent so realtime/db updates are reflected
    // inside the modal immediately.
    setItems(initialItems || [])
  }, [initialItems, sku, open])

  // remember last non-empty items so transient empty responses don't blank the UI
  useEffect(() => {
    if (items && items.length > 0) lastNonEmptyItems.current = items
  }, [items])

  // Fetch payment page data when modal opens and a transactionId is provided
  useEffect(() => {
    if (!open) return
    if (!transactionId) return

    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_transaction_packing_detail', { p_transaction_id: transactionId })
        if (error) {
          console.error('get_transaction_packing_detail rpc error', error)
          return
        }
        if (!mounted) return

        const payload: any = data ?? {}
        console.debug('get_payment_page_data payload:', payload)
        setTopStatus(payload.status ?? null)
        setTxnId(payload.transaction_id ?? transactionId ?? null)
        setReceiptUrl(payload.receipt_url ?? payload.receiptUrl ?? null)
        setWhatsappContact(payload.whatsapp ?? null)
        setTopCustomerName(payload.customer_name ?? payload.customerName ?? null)
        setSubtotal(typeof payload.subtotal === 'number' ? payload.subtotal : null)
        setShippingFee(typeof payload.shipping_fee === 'number' ? payload.shipping_fee : null)
        setTotalToPay(typeof payload.total_to_pay === 'number' ? payload.total_to_pay : null)
        setPaymentDeadline(payload.payment_deadline ?? null)

        // Map orders object to flattened items the modal expects
        const mapped: Registration[] = []
        const orders = payload.orders || {}

        const getFirst = (obj: any, keys: string[]) => {
          if (!obj || typeof obj !== 'object') return undefined
          for (const k of keys) {
            if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '') return obj[k]
            const foundKey = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase())
            if (foundKey && obj[foundKey] != null && obj[foundKey] !== '') return obj[foundKey]
          }
          return undefined
        }

        Object.entries(orders).forEach(([orderNumber, arr]) => {
          ;(arr as any[]).forEach((it: any) => {
            const skuVal = getFirst(it, ['sku_code', 'sku_code_snapshot', 'sku', 'skuCode']) ?? sku ?? ''
            const imageVal = getFirst(it, ['image_url', 'imageUrl', 'thumbnail_url', 'thumbnail', 'image']) ?? ''
            const variationVal = getFirst(it, ['variation', 'variation_snapshot', 'variation_snapshot_text']) ?? ''
            const quantityRaw = getFirst(it, ['quantity', 'qty', 'count'])
            const quantityVal = typeof quantityRaw === 'number' ? quantityRaw : (Number(quantityRaw) || 1)
            const priceRaw = getFirst(it, ['price', 'row_total', 'amount'])
            const priceVal = typeof priceRaw === 'number' ? priceRaw : (Number(priceRaw) || undefined)
            const statusVal = getFirst(it, ['status']) ?? payload.status ?? 'pending'
            const remarkVal = getFirst(it, ['remark', 'note', 'notes']) ?? null

            // attempt to find image inside nested structures (e.g., SKU_details)
            let finalImage = imageVal
            if (!finalImage && it.SKU_details && Array.isArray(it.SKU_details.SKU_images)) {
              const img = it.SKU_details.SKU_images[0]
              finalImage = img?.imageurl ?? finalImage
            }

            mapped.push({
              id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
              orderNumber,
              sku: skuVal || 'Unknown',
              imageUrl: finalImage || undefined,
              variation: variationVal,
              quantity: quantityVal,
              price: priceVal,
              status: (statusVal || 'pending') as any,
              remark: remarkVal,
              // include top-level contact and indicators
              customerName: getFirst(it, ['customer_name', 'name']) ?? '',
              whatsapp: payload.whatsapp ?? getFirst(it, ['whatsapp']) ?? '',
              timestamp: toSafeDate(getFirst(it, ['created_at', 'timestamp'])) ?? new Date(),
              is_in_current_txn: !!getFirst(it, ['is_in_current_txn', 'isInCurrentTxn', 'in_current_txn']),
            } as unknown as Registration)
          })
        })
        console.debug('mapped payment items:', mapped)

        setItems(mapped)
        // initialize packedIds for items that are already marked as pending-to-ship
        try {
          const initialPacked = mapped
            .filter((it) => {
              const s = String((it as any).status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
              return s === 'prependingtoship' || s === 'pendingtoship'
            })
            .map((it) => String(it.id))
          if (initialPacked.length > 0) setPackedIds(initialPacked)
        } catch (e) {
          // defensive: if anything goes wrong, don't crash the modal
          console.debug('init packedIds failed', e)
        }
      } catch (err) {
        console.error('fetch payment page data failed', err)
      }
    })()

    return () => { mounted = false }
  }, [open, transactionId])

  // split items into those that belong to current transaction and others
  const displayedItems = (items && items.length > 0) ? items : (lastNonEmptyItems.current ?? [])

  const inCurrentTxn = displayedItems.filter((it) => {
    if (!((it as any).is_in_current_txn)) return false
    const s = String((it as any).status ?? '').toLowerCase().trim()
    const normalized = s.replace(/[-_]/g, '')
    const accepted = ['verified', 'pendingtoship', 'prependingtoship']
    return accepted.includes(normalized)
  })

  // remember last non-empty current-txn list to avoid temporary blanking
  useEffect(() => {
    if (inCurrentTxn && inCurrentTxn.length > 0) lastNonEmptyInCurrentTxn.current = inCurrentTxn
  }, [inCurrentTxn])

  const displayedInCurrentTxn = (inCurrentTxn && inCurrentTxn.length > 0) ? inCurrentTxn : (lastNonEmptyInCurrentTxn.current ?? [])
  // related orders removed: we only show items that belong to current transaction

  // helper to toggle packed state for an item (optimistic + RPC)
  const togglePacked = async (id?: string | number) => {
    if (!id) return
    const sid = String(id)
    const currentlyPacked = packedIds.includes(sid)
    const newPacked = !currentlyPacked

    // optimistic update
    setPackedIds((prev) => (currentlyPacked ? prev.filter((x) => x !== sid) : [...prev, sid]))

    try {
      const { data, error } = await supabase.rpc('toggle_item_packed_status', { p_order_id: sid, p_is_packed: newPacked })
      if (error) {
        console.error('toggle_item_packed_status rpc error', error)
        // revert optimistic update
        setPackedIds((prev) => (newPacked ? prev.filter((x) => x !== sid) : [...prev, sid]))
        window.alert('更新打包狀態失敗：' + (error.message || JSON.stringify(error)))
        return
      }
      console.debug('toggle_item_packed_status result', data)
      // refresh payment items for the current transaction so UI stays in sync
      if (transactionId) {
        try {
          const payloadData = await getPaymentPageData(transactionId)
          if (payloadData) {
            const payload: any = payloadData ?? {}
            const orders = payload.orders || {}
            const mapped: Registration[] = []
            const getFirst = (obj: any, keys: string[]) => {
              if (!obj || typeof obj !== 'object') return undefined
              for (const k of keys) {
                if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '') return obj[k]
                const foundKey = Object.keys(obj).find((x) => x.toLowerCase() === k.toLowerCase())
                if (foundKey && obj[foundKey] != null && obj[foundKey] !== '') return obj[foundKey]
              }
              return undefined
            }

            Object.entries(orders).forEach(([orderNumber, arr]) => {
              ;(arr as any[]).forEach((it: any) => {
                const skuVal = getFirst(it, ['sku_code', 'sku_code_snapshot', 'sku', 'skuCode']) ?? sku ?? ''
                const imageVal = getFirst(it, ['image_url', 'imageUrl', 'thumbnail_url', 'thumbnail', 'image']) ?? ''
                const variationVal = getFirst(it, ['variation', 'variation_snapshot', 'variation_snapshot_text']) ?? ''
                const quantityRaw = getFirst(it, ['quantity', 'qty', 'count'])
                const quantityVal = typeof quantityRaw === 'number' ? quantityRaw : (Number(quantityRaw) || 1)
                const priceRaw = getFirst(it, ['price', 'row_total', 'amount'])
                const priceVal = typeof priceRaw === 'number' ? priceRaw : (Number(priceRaw) || undefined)
                const statusVal = getFirst(it, ['status']) ?? payload.status ?? 'pending'
                const remarkVal = getFirst(it, ['remark', 'note', 'notes']) ?? null

                let finalImage = imageVal
                if (!finalImage && it.SKU_details && Array.isArray(it.SKU_details.SKU_images)) {
                  const img = it.SKU_details.SKU_images[0]
                  finalImage = img?.imageurl ?? finalImage
                }

                mapped.push({
                  id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                  orderNumber,
                  sku: skuVal || 'Unknown',
                  imageUrl: finalImage || undefined,
                  variation: variationVal,
                  quantity: quantityVal,
                  price: priceVal,
                  status: (statusVal || 'pending') as any,
                  remark: remarkVal,
                  customerName: getFirst(it, ['customer_name', 'name']) ?? '',
                  whatsapp: payload.whatsapp ?? getFirst(it, ['whatsapp']) ?? '',
                  timestamp: toSafeDate(getFirst(it, ['created_at', 'timestamp'])) ?? new Date(),
                  is_in_current_txn: !!getFirst(it, ['is_in_current_txn', 'isInCurrentTxn', 'in_current_txn']),
                } as unknown as Registration)
              })
            })

            if (Array.isArray(mapped) && mapped.length > 0) {
              setItems(mapped)
              // re-init packedIds from returned payload to reflect server state
              try {
                const initialPacked = mapped
                  .filter((it) => {
                    const s = String((it as any).status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
                    return s === 'prependingtoship' || s === 'pendingtoship'
                  })
                  .map((it) => String(it.id))
                setPackedIds(initialPacked)
              } catch (e) {
                console.debug('init packedIds failed after toggle refresh', e)
              }
            } else {
              console.debug('togglePacked: refresh returned empty mapped items — keeping existing `items` and `packedIds`')
            }
          }
        } catch (e) {
          console.debug('refresh payment page data after toggle failed', e)
        }
      }
    } catch (err) {
      console.error('toggle_item_packed_status failed', err)
      setPackedIds((prev) => (newPacked ? prev.filter((x) => x !== sid) : [...prev, sid]))
      window.alert('更新打包狀態時發生錯誤')
    }
  }

  // progress calculation: consider both `verified` and pre-/pending-to-ship items
  const normalizedStatus = (s: any) => String(s ?? '').toLowerCase().trim().replace(/[-_]/g, '')
  const relevantItems = inCurrentTxn.filter((it) => {
    const s = normalizedStatus((it as any).status)
    return s === 'verified' || s === 'prependingtoship' || s === 'pendingtoship'
  })
  const relevantCount = relevantItems.length
  // count items that are either in local `packedIds` OR already have a pre/pending-to-ship status
  const packedRelevant = relevantItems.filter((it) => {
    const sid = String(it.id)
    const s = normalizedStatus((it as any).status)
    return packedIds.includes(sid) || s === 'prependingtoship' || s === 'pendingtoship'
  }).length
  const denominator = relevantCount > 0 ? relevantCount : (inCurrentTxn.length || 1)
  const progressPercent = Math.round((packedRelevant / denominator) * 100)

  // RPC: mark packed orders as pending to ship
  const handleCompletePack = async () => {
    if (packedIds.length === 0) return
    setIsPacking(true)
    try {
      const { data, error } = await supabase.rpc('batch_set_pending_to_ship', { p_order_ids: packedIds })
      if (error) {
        console.error('batch_set_pending_to_ship rpc error', error)
        window.alert('標記出貨失敗：' + (error.message || JSON.stringify(error)))
        return
      }
      console.debug('batch_set_pending_to_ship result', data)
      // clear packed selection and inform user, then close modal after alert is dismissed
      setPackedIds([])
      window.alert('已標記為待出貨')
      onOpenChange(false)
    } catch (err) {
      console.error('batch_set_pending_to_ship failed', err)
      window.alert('標記出貨時發生錯誤')
    } finally {
      setIsPacking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 w-full max-w-90vw flex flex-col overflow-hidden duration-200">
         <div className="bg-white z-10 border-b border-gray-100 flex items-center justify-between px-4 py-3 relative">
          <div className="flex-1 min-w-0 text-center">
            <DialogTitle className="font-bold text-md truncate mb-4">打包明細</DialogTitle>
             

              {/* Packing progress bar (top) */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <div>打包進度</div>
                  <div>{progressPercent}% ({packedRelevant}/{denominator})</div>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }} />
                </div>
                {/** progress action moved to footer **/}
              </div>

              <div className="mt-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {txnId ? <div className="text-left text-gray-600 font-bold ">交易編號: {txnId}</div> : null}
                  </div>
                 
                </div>
                <div className="flex items-start mt-1 gap-4">
                  <div className=" text-xs text-gray-600 ">
                    {(topCustomerName || displayedItems?.[0]?.customerName) ? <>顧客: {topCustomerName ?? displayedItems[0].customerName}</> : null}
                  </div>
                    <div className=" text-xs text-gray-600 ">
                    {whatsappContact ? <>聯絡電話: {whatsappContact}</> : null}
                  </div>
                </div>
              </div>
          </div>
          <DialogClose className="absolute right-1 top-1 p-2 text-xl text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
            ×
          </DialogClose>
         </div>

         <div className="flex-1 overflow-y-auto bg-white p-4">
           {(!displayedItems || displayedItems.length === 0) ? (
             <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
           ) : (
             <div className="space-y-4">
               {displayedInCurrentTxn.length > 0 ? (
                 <div className="space-y-3">
                   <div className="text-xs font-medium">本交易訂單 ({displayedInCurrentTxn.length})</div>
                   {displayedInCurrentTxn.map((r) => {
                     const rowTotal = typeof (r as any).row_total === 'number'
                       ? (r as any).row_total
                       : (typeof r.price === 'number' ? r.price * ((r as any).quantity ?? 1) : undefined)

                      const isPacked = packedIds.includes(String(r.id))
                      const statusNorm = String((r as any).status ?? '').toLowerCase().trim().replace(/[-_]/g, '')
                      // show overlay is driven by local packed state so user can toggle it
                      const showOverlay = isPacked

                     return (
                     <div key={r.id} className={`bg-white shadow rounded-lg overflow-hidden ${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                       <div className="bg-[#c4a59d] px-4 py-2 text-xs text-white flex items-center justify-between">
                         <div className="">訂單 #{r.orderNumber}</div>
                       </div>

                         <div className={`p-3 flex items-center gap-4 relative ${isCancelledStatus(r.status) ? '' : ''}`} onClick={() => togglePacked(r.id)}>
                           {showOverlay ? (
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'rgba(16,185,129,0.89)' }}>
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                              <CheckCircle2 className="w-5 h-5" />
                              已打包
                            </div>
                           </div>
                         ) : null}
                         <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                           {(r.imageUrl || (r as any).thumbnail_url) ? (
                             <img src={r.imageUrl ?? (r as any).thumbnail_url} alt={r.sku} className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">無圖</div>
                           )}
                         </div>

                         <div className="flex-1 min-w-0">
                           <div className="text-md font-semibold ">{r.sku}</div>
                           <div className="text-xs text-gray-500 mt-1 ">
                             {r.variation} <span className="text-gray-400">x{(r as any).quantity ?? 1}</span>
                             {(r as any).remark ? (
                               <span className="text-[9px] text-gray-500 ml-2">備註: {(r as any).remark}</span>
                             ) : null}
                           </div>
                         </div>

                         <div className="text-right w-28">
                          
                           <div className="text-md font-bold">{typeof r.price === 'number' ? `$ ${r.price}` : ((r as any).price ? `$ ${(r as any).price}` : '')}</div>
                         
                           
                         </div>
                       </div>
                     </div>
                   )})}
                 </div>
               ) : null}

               {/* Related orders removed — modal only displays current-transaction items */}

               {/* Cancelled / Waitlist items */}
               {(() => {
                 const cancelledWaitlist = displayedItems.filter((it) => {
                   const s = normalizedStatus((it as any).status)
                   return s === 'waitlist' || s.includes('cancel')
                 })
                 if (!cancelledWaitlist || cancelledWaitlist.length === 0) return null

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">候補中 / 已取消訂單 ({cancelledWaitlist.length})</div>
                      <button
                        type="button"
                        aria-expanded={showOtherItems}
                        onClick={() => setShowOtherItems((s) => !s)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600"
                        title={showOtherItems ? '收起' : '展開'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showOtherItems ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showOtherItems ? (
                      <div className="space-y-2 opacity-50 text-gray-500">
                        {cancelledWaitlist.map((r) => {
                       const rowTotal = typeof (r as any).row_total === 'number'
                         ? (r as any).row_total
                         : (typeof r.price === 'number' ? r.price * ((r as any).quantity ?? 1) : undefined)

                       return (
                         <div key={r.id} className={`bg-white shadow rounded-lg overflow-hidden ${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                           <div className="bg-black px-4 py-2 text-xs text-white flex items-center justify-between">
                             <div className="">訂單 #{r.orderNumber}</div>
                           </div>

                           <div className="p-3 flex items-center gap-4 relative">
                             <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                               {(r.imageUrl || (r as any).thumbnail_url) ? (
                                 <img src={r.imageUrl ?? (r as any).thumbnail_url} alt={r.sku} className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">無圖</div>
                               )}
                             </div>

                             <div className="flex-1 min-w-0">
                               <div className="text-md font-semibold ">{r.sku}</div>
                               <div className="text-xs text-gray-500 mt-1 ">
                                 {r.variation} <span className="text-gray-400">x{(r as any).quantity ?? 1}</span>
                                 {(r as any).remark ? (
                                   <span className="text-[9px] text-gray-500 ml-2">備註: {(r as any).remark}</span>
                                 ) : null}
                               </div>
                             </div>

                             <div className="text-right w-28">
                               <div className="text-md font-bold">{typeof r.price === 'number' ? `$ ${r.price}` : ((r as any).price ? `$ ${(r as any).price}` : '')}</div>
                             </div>
                           </div>
                         </div>
                       )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
               })()}
             </div>
           )}
         </div>
        {/* Footer: totals and payment info */}
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          
          
          <div className="flex items-start justify-between text-md font-bold text-gray-900 mt-3">
            <div>已付總額: {totalToPay !== null ? `$ ${totalToPay}` : '-'}</div>
            <div className="flex items-start gap-3">
              
              {receiptUrl ? (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2 py-1" onClick={() => window.open(receiptUrl as string, '_blank', 'noopener,noreferrer')}>
                  查看入數證明
                </Button>
              ) : null}
              {progressPercent === 100 ? (
                <Button size="sm" className="h-7 text-xs px-2 py-1 bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" onClick={handleCompletePack} disabled={isPacking}>
                  {isPacking ? '處理中...' : '完成打包'}
                </Button>
              ) : null}
            </div>
          </div>
          {paymentDeadline ? (
            <div className="text-xs text-gray-500 mt-2">付款截止: {paymentDeadline}</div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}