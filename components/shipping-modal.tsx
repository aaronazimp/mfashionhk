"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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
    whatsapp?: string | null
}

// Use shared OrderStatusBadge for consistent badge rendering


// Safe date helpers to avoid runtime RangeError when timestamps are invalid
function toSafeDate(d: any): Date | null {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    return !isNaN(dt.getTime()) ? dt : null;
}

// helper to detect cancelled status values
function isCancelledStatus(status: any): boolean {
    // Grey-out rule: only `pending_to_ship` should NOT be greyed.
    // Everything else (including null/undefined) is considered greyed out.
    if (status === null || status === undefined) return true
    try {
        const s = String(status).toLowerCase().trim()
        const normalized = s.replace(/[-_]/g, '')
        return normalized !== 'pendingtoship'
    } catch (e) {
        return true
    }
}

export default function OrderModal({ open, onOpenChange, sku, initialItems = [], initialSelectedItemId, title, product, onAction, formatTime, transactionId, whatsapp }: Props) {
    const [items, setItems] = useState<Registration[]>(initialItems)
    const [subtotal, setSubtotal] = useState<number | null>(null)
    const [shippingFee, setShippingFee] = useState<number | null>(null)
    const [totalToPay, setTotalToPay] = useState<number | null>(null)
    const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null)
    const [topStatus, setTopStatus] = useState<string | null>(null)
    const [txnId, setTxnId] = useState<string | null>(null)
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
    const [whatsappContact, setWhatsappContact] = useState<string | null>(null)
    const [topCustomerName, setTopCustomerName] = useState<string | null>(null)
    const [manualWhatsapp, setManualWhatsapp] = useState<string>('')
    const [orderCards, setOrderCards] = useState<any[]>([])
    const [collapsedOrders, setCollapsedOrders] = useState<Record<string, boolean>>({})
    const [expandedImage, setExpandedImage] = useState<string | null>(null)
    
    const { toast } = useToast()
    
    

    useEffect(() => {
        setItems(initialItems || [])
    }, [initialItems, sku])

    // Close expanded image on Escape
    useEffect(() => {
        if (!expandedImage) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setExpandedImage(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [expandedImage])

    // helper to fetch bags by whatsapp (exposed for manual lookup)
    const fetchBagsByWhatsapp = async (whatsapp: string) => {
        if (!whatsapp) return
        try {
            const params = { p_whatsapp: String(whatsapp) }
            const res = await supabase.rpc('get_customer_bags_detail', params)
            const payload: any = res.data ?? {}
            // reuse mapping logic below by directly setting data and letting effect mapping run
            // but to avoid duplication, perform a minimal inline mapping here
            // New RPC shape: payload may be wrapped in an array with key `get_customer_bags_detail`.
            const unwrap = (p: any) => {
                if (!p) return p
                if (Array.isArray(p) && p.length > 0 && p[0].get_customer_bags_detail) return p[0].get_customer_bags_detail
                return p
            }

            const normalized = unwrap(payload)

            const cards: any[] = []
            if (normalized && Array.isArray(normalized.bags)) {
                normalized.bags.forEach((bag: any) => {
                    const bagTxn = bag.transaction_id ?? ''
                    const bagReceipt = bag.receipt_url ?? null

                    ;(bag.orders || []).forEach((order: any) => {
                        const orderNumber = order.order_number ?? (order.orderNumber ?? '')
                        const itemsList = order.items || order.active || []
                        const activeItems: Registration[] = (itemsList || []).map((it: any) => ({
                            id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                            orderNumber,
                            transactionId: bagTxn ?? undefined,
                            sku: it.sku_code ?? it.sku ?? 'Unknown',
                            imageUrl: it.image_url ?? it.imageUrl ?? undefined,
                            variation: it.variation ?? '' ,
                            quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 1),
                            price: typeof it.price === 'number' ? it.price : (Number(it.price) || undefined),
                            status: it.status ?? 'pending',
                            remark: it.remark ?? null,
                            customerName: normalized.customer_name ?? '',
                            whatsapp: normalized.whatsapp ?? '',
                            timestamp: toSafeDate(it.created_at ?? it.timestamp) ?? new Date(),
                        } as unknown as Registration))

                        const historicalItems: Registration[] = (order.historical || []).map((it: any) => ({
                            id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                            orderNumber,
                            transactionId: bagTxn ?? undefined,
                            sku: it.sku_code ?? it.sku ?? 'Unknown',
                            imageUrl: it.image_url ?? it.imageUrl ?? undefined,
                            variation: it.variation ?? '' ,
                            quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 1),
                            price: typeof it.price === 'number' ? it.price : (Number(it.price) || undefined),
                            status: it.status ?? 'pending',
                            remark: it.remark ?? null,
                            customerName: normalized.customer_name ?? '',
                            whatsapp: normalized.whatsapp ?? '',
                            timestamp: toSafeDate(it.created_at ?? it.timestamp) ?? new Date(),
                        } as unknown as Registration))

                            cards.push({
                            orderNumber,
                            transactionId: bagTxn,
                            receiptUrl: bagReceipt,
                            active: activeItems,
                            historical: historicalItems,
                        })
                    })
                })
            }

            setOrderCards(cards)
            setCollapsedOrders(Object.fromEntries(cards.map((c: any) => [c.orderNumber, true])))
            // flatten items for backwards compatibility where needed
            setItems(cards.flatMap(c => [...(c.active || []), ...(c.historical || [])]))
            setTopStatus(normalized.status ?? null)
            setTxnId(normalized.transaction_id ?? null)
            setReceiptUrl(normalized.receipt_url ?? normalized.receiptUrl ?? (normalized.bags && normalized.bags[0]?.receipt_url) ?? null)
            setWhatsappContact(normalized.whatsapp ?? whatsapp)
            setTopCustomerName(normalized.customer_name ?? null)
            setSubtotal(typeof normalized.subtotal === 'number' ? normalized.subtotal : null)
            setShippingFee(typeof normalized.shipping_fee === 'number' ? normalized.shipping_fee : null)
            setTotalToPay(typeof normalized.total_payable === 'number' ? normalized.total_payable : (typeof normalized.total_to_pay === 'number' ? normalized.total_to_pay : null))
            setPaymentDeadline(normalized.payment_deadline ?? null)
        } catch (err) {
            console.error('manual fetch get_customer_bags_detail failed', err)
        } finally {
        }
    }

    // Batch-ship RPC: call `batch_ship_transaction_items(p_whatsapp, p_transaction_ids)`
    const batchShipTransaction = async () => {
        const p_whatsapp = whatsappContact ?? (items && items.length > 0 ? items[0].whatsapp : null)
        // Collect transaction ids from multiple sources (orderCards, top-level txnId/prop)
        const gathered: string[] = []
        try {
            // collect from orderCards
            (orderCards || []).forEach((c: any) => {
                if (c && c.transactionId) gathered.push(String(c.transactionId))
            })
        } catch (e) {
            // ignore collection errors
        }

        if (txnId) gathered.push(String(txnId))
        if (transactionId) gathered.push(String(transactionId))

        // normalize and dedupe; strip common prefixes like `group-` or `tx-`
        const normalizedIds = Array.from(new Set(gathered
            .filter(Boolean)
            .map((s) => String(s).trim())
            .map((s) => s.replace(/^group-/i, '').replace(/^tx-/i, ''))
        ))

        const p_transaction_ids = normalizedIds.length > 0 ? normalizedIds : null

        if (!p_whatsapp && !p_transaction_ids) {
            toast({ title: '缺少參數', description: '請提供聯絡電話或交易編號以執行批量出貨' })
            return
        }

        try {
            const params: any = {}
            if (p_whatsapp) params.p_whatsapp = String(p_whatsapp)
            if (p_transaction_ids) params.p_transaction_ids = p_transaction_ids

            let res = await supabase.rpc('batch_ship_transaction_items', params)
            console.log('batch_ship_transaction_items initial response', { params, res })
            // some PostgREST setups don't accept JSON arrays for TEXT[] params;
            // if the first call returns an error, retry using a Postgres array literal string
            if (res.error && p_transaction_ids) {
                console.warn('RPC initial call failed, retrying with PG array literal', { error: res.error })
                const pgArray = '{' + p_transaction_ids.map((s: string) => String(s).replace(/(["\\])/g, '\\$1')).join(',') + '}'
                const retryParams: any = { ...(p_whatsapp ? { p_whatsapp: String(p_whatsapp) } : {}), p_transaction_ids: pgArray }
                res = await supabase.rpc('batch_ship_transaction_items', retryParams)
                console.log('batch_ship_transaction_items retry response', { retryParams, res })
            }

            if (res.error) {
                console.error('batch_ship_transaction_items rpc final error', { params: (typeof params !== 'undefined' ? params : undefined), res })
                // surface error to user briefly
                try {
                    const eMsg = res.error?.message ?? JSON.stringify(res.error)
                    toast({ title: 'RPC 錯誤', description: String(eMsg).slice(0, 200) })
                } catch (e) {
                    // ignore toast failures
                }
                throw res.error
            }

            toast({ title: '已標記出貨', description: '已批量標記交易內項目為已出貨' })
            // Close the modal now that the RPC completed successfully
            try {
                onOpenChange(false)
            } catch (e) {
                console.warn('onOpenChange threw', e)
            }
            try {
                if (p_whatsapp) await fetchBagsByWhatsapp(String(p_whatsapp))
            } catch (e) {
                console.error('refresh after batch ship failed', e)
            }
        } catch (err: any) {
            const msg = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err))
            try { toast({ title: '標記失敗', description: String(msg).slice(0, 200) }) } catch (e) {}
            console.error('batch_ship_transaction_items rpc error (caught)', err)
            console.log('full caught error object', err)
        }
    }

    // Fetch payment page data when modal opens and a transactionId is provided
    useEffect(() => {
        if (!open) return

        let mounted = true
        ;(async () => {
            try {
                // build RPC params using whatsapp as the primary key per updated RPC signature
                const fallbackWhatsapp = whatsapp ?? (
                    (initialItems && initialItems.length > 0 && (initialItems[0] as any).whatsapp)
                    || (items && items.length > 0 && (items[0] as any).whatsapp)
                    || null
                )

                const params: any = {}
                if (fallbackWhatsapp) {
                    params.p_whatsapp = String(fallbackWhatsapp)
                    // Do NOT include `p_transaction_id` when calling with `p_whatsapp`.
                    // The DB function currently expects a single `p_whatsapp` param.
                } else {
                    // The DB function `get_customer_bags_detail` expects `p_whatsapp`.
                    // Do NOT attempt to call it with `p_transaction_id` — that will
                    // trigger PGRST202 (function not found). Skip the RPC and warn.
                    console.warn('Skipping get_customer_bags_detail RPC: missing whatsapp; function expects p_whatsapp', { transactionId, fallbackWhatsapp })
                    return
                }

                const isWhatsappQuery = Boolean(params.p_whatsapp)
                let data: any = null
                let error: any = null
                try {
                    const res = await supabase.rpc('get_customer_bags_detail', params)
                    data = res.data
                    error = res.error
                } catch (rpcErr) {
                    console.error('get_customer_bags_detail RPC threw an exception', rpcErr)
                    // If the RPC throws, present the thrown object as `error` for downstream handling
                    error = rpcErr
                }
                // Supabase may return an "error" object that's empty ({}) or with
                // non-enumerable fields. Consider an error meaningful only when it
                // contains a non-empty string value, or has one of the common
                // error fields populated with a non-empty value.

                const isStringError = typeof error === 'string' && String(error).trim() !== ''
                const hasErrorFields = Boolean(error && typeof error === 'object' && ['message', 'code', 'details'].some((k) => {
                    try {
                        const v = (error as any)[k]
                        return v != null && String(v).trim() !== ''
                    } catch (e) {
                        return false
                    }
                }))

                // Some Supabase error objects may be non-enumerable or empty (`{}`).
                // Only treat the RPC as failing when there's a clear error string,
                // known populated error fields, or when serializing the error
                // yields content (not just `{}`). This avoids false positives
                // when the runtime logs `{}` in the console.
                let hasMeaningfulError = Boolean(isStringError || hasErrorFields)
                if (!hasMeaningfulError && error && typeof error === 'object') {
                    try {
                        const serialized = JSON.stringify(error)
                        if (serialized && serialized !== '{}' && serialized !== 'null') {
                            hasMeaningfulError = true
                        }
                    } catch (e) {
                        // ignore serialization errors
                    }
                }

                console.debug('get_customer_bags_detail rpc result', { params, data, error, hasMeaningfulError })

                const isEmptyData = data == null || (typeof data === 'object' && Object.keys(data).length === 0)
                // Abort only when there's a meaningful error and no data at all.
                if (hasMeaningfulError && data == null) {
                    console.error('get_customer_bags_detail rpc error', error)
                    return
                }

                // If there's a meaningful error but some payload exists, warn and continue.
                if (hasMeaningfulError) {
                    console.warn('get_customer_bags_detail rpc returned error (non-fatal) with payload', { params, data, error })
                } else if (isEmptyData) {
                    console.warn('get_customer_bags_detail returned empty data (non-fatal)', { params, data, error })
                }
                if (!mounted) return

                const payload: any = data ?? {}
                console.debug('get_payment_page_data payload:', payload)
                setTopStatus(payload.status ?? null)
                setTxnId(payload.transaction_id ?? transactionId ?? null)
                setReceiptUrl(payload.receipt_url ?? payload.receiptUrl ?? null)
                setWhatsappContact(payload.whatsapp ?? whatsapp ?? null)
                setTopCustomerName(payload.customer_name ?? payload.customerName ?? null)
                setSubtotal(typeof payload.subtotal === 'number' ? payload.subtotal : null)
                setShippingFee(typeof payload.shipping_fee === 'number' ? payload.shipping_fee : null)
                setTotalToPay(typeof payload.total_payable === 'number' ? payload.total_payable : (typeof payload.total_to_pay === 'number' ? payload.total_to_pay : null))
                setPaymentDeadline(payload.payment_deadline ?? null)

                // Map bags payload (from get_customer_bags_detail) OR fallback to orders object
                // Normalize wrapper if needed
                const unwrap = (p: any) => {
                    if (!p) return p
                    if (Array.isArray(p) && p.length > 0 && p[0].get_customer_bags_detail) return p[0].get_customer_bags_detail
                    return p
                }

                const normalized = unwrap(payload)

                const cards: any[] = []

                if (normalized && Array.isArray(normalized.bags)) {
                    normalized.bags.forEach((bag: any) => {
                        const bagTxn = bag.transaction_id ?? ''
                        const bagReceipt = bag.receipt_url ?? null

                        // New RPC shape: base_orders -> suffixes -> items
                        if (Array.isArray(bag.base_orders) && bag.base_orders.length > 0) {
                            bag.base_orders.forEach((baseOrder: any) => {
                                const baseOrderNumber = baseOrder.base_order_number ?? ''
                                ;(baseOrder.suffixes || []).forEach((suffix: any) => {
                                    const orderNumber = suffix.suffix_id ?? baseOrderNumber
                                    const activeItems: Registration[] = (suffix.items || []).map((it: any) => ({
                                        id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                                        orderNumber,
                                        transactionId: bagTxn ?? undefined,
                                        sku: it.sku_code ?? it.sku ?? 'Unknown',
                                        imageUrl: it.image_url ?? it.imageUrl ?? undefined,
                                        variation: it.variation ?? '' ,
                                        quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 1),
                                        price: typeof it.price === 'number' ? it.price : (Number(it.price) || undefined),
                                        status: it.status ?? 'pending',
                                        remark: it.remark ?? null,
                                        customerName: normalized.customer_name ?? '',
                                        whatsapp: normalized.whatsapp ?? '',
                                        timestamp: toSafeDate(it.created_at ?? it.timestamp) ?? new Date(),
                                    } as unknown as Registration))

                                    const historicalItems: Registration[] = []

                                    cards.push({
                                        orderNumber,
                                        transactionId: bagTxn,
                                        receiptUrl: bagReceipt,
                                        active: activeItems,
                                        historical: historicalItems,
                                    })
                                })
                            })
                        } else {
                            ;(bag.orders || []).forEach((order: any) => {
                                const orderNumber = order.order_number ?? (order.orderNumber ?? '')
                                const itemsList = order.items || order.active || []
                                const activeItems: Registration[] = (itemsList || []).map((it: any) => ({
                                    id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                                    orderNumber,
                                    transactionId: bagTxn ?? undefined,
                                    sku: it.sku_code ?? it.sku ?? 'Unknown',
                                    imageUrl: it.image_url ?? it.imageUrl ?? undefined,
                                    variation: it.variation ?? '' ,
                                    quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 1),
                                    price: typeof it.price === 'number' ? it.price : (Number(it.price) || undefined),
                                    status: it.status ?? 'pending',
                                    remark: it.remark ?? null,
                                    customerName: normalized.customer_name ?? '',
                                    whatsapp: normalized.whatsapp ?? '',
                                    timestamp: toSafeDate(it.created_at ?? it.timestamp) ?? new Date(),
                                } as unknown as Registration))

                                const historicalItems: Registration[] = (order.historical || []).map((it: any) => ({
                                    id: it.id ?? `${orderNumber}-${Math.random().toString(36).slice(2,8)}`,
                                    orderNumber,
                                    transactionId: bagTxn ?? undefined,
                                    sku: it.sku_code ?? it.sku ?? 'Unknown',
                                    imageUrl: it.image_url ?? it.imageUrl ?? undefined,
                                    variation: it.variation ?? '' ,
                                    quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 1),
                                    price: typeof it.price === 'number' ? it.price : (Number(it.price) || undefined),
                                    status: it.status ?? 'pending',
                                    remark: it.remark ?? null,
                                    customerName: normalized.customer_name ?? '',
                                    whatsapp: normalized.whatsapp ?? '',
                                    timestamp: toSafeDate(it.created_at ?? it.timestamp) ?? new Date(),
                                } as unknown as Registration))

                                cards.push({
                                    orderNumber,
                                    transactionId: bagTxn,
                                    receiptUrl: bagReceipt,
                                    active: activeItems,
                                    historical: historicalItems,
                                })
                            })
                        }
                    })
                } else {
                    // fallback to older `orders` shape
                    const orders = normalized?.orders || {}

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
                            const statusVal = getFirst(it, ['status']) ?? normalized.status ?? 'pending'
                            const remarkVal = getFirst(it, ['remark', 'note', 'notes']) ?? null

                            let finalImage = imageVal
                            if (!finalImage && it.SKU_details && Array.isArray(it.SKU_details.SKU_images)) {
                                const img = it.SKU_details.SKU_images[0]
                                finalImage = img?.imageurl ?? finalImage
                            }

                            cards.push({
                                orderNumber,
                                transactionId: undefined,
                                receiptUrl: undefined,
                                active: [{
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
                                    whatsapp: normalized.whatsapp ?? getFirst(it, ['whatsapp']) ?? '',
                                    timestamp: toSafeDate(getFirst(it, ['created_at', 'timestamp'])) ?? new Date(),
                                    is_in_current_txn: !!getFirst(it, ['is_in_current_txn', 'isInCurrentTxn', 'in_current_txn']),
                                } as unknown as Registration],
                                historical: [],
                            })
                        })
                    })
                }

                console.debug('mapped payment order cards:', cards)

                setOrderCards(cards)
                setCollapsedOrders(Object.fromEntries(cards.map((c: any) => [c.orderNumber, true])))
                setItems(cards.flatMap(c => [...(c.active || []), ...(c.historical || [])]))
            } catch (err) {
                console.error('fetch payment page data failed', err)
            }
        })()

        return () => { mounted = false }
    }, [open, transactionId])

    // Render grouped order cards (active + historical)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 gap-0 w-full max-w-90vw flex flex-col overflow-hidden duration-200">
                 <div className="bg-white z-10 border-b border-gray-100 flex items-center justify-between px-4 py-3 relative">
                    <div className="flex-1 min-w-0 text-center">
                        <DialogTitle className="font-bold text-md mb-4">打包明細</DialogTitle>

                            <div className="mt-3 text-xs">
                                
                                <div className="flex items-start mt-1 gap-4">
                                    <div className=" text-xs text-gray-600 ">
                                        {(topCustomerName || items?.[0]?.customerName) ? <>顧客: {topCustomerName ?? items[0].customerName}</> : null}
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
                         {orderCards.length === 0 ? (
                             <div className="text-center py-8 text-gray-400">沒有相關訂單</div>
                         ) : (
                             <div className="space-y-4">
                                {/** group orderCards by transaction id (fall back to top-level txnId) */}
                                {(() => {
                                    const groups = new Map<string, any>()
                                    orderCards.forEach((card: any) => {
                                        const key = String(card.transactionId ?? txnId ?? 'NO_TXN')
                                        if (!groups.has(key)) {
                                            groups.set(key, { transactionId: key === 'NO_TXN' ? null : key, receiptUrl: card.receiptUrl ?? null, orders: [] })
                                        }
                                        const g = groups.get(key)
                                        g.orders.push(card)
                                        if (!g.receiptUrl && card.receiptUrl) g.receiptUrl = card.receiptUrl
                                    })
                                    return Array.from(groups.values()).map((group) => (
                                        <div key={group.transactionId ?? Math.random()} className="space-y-2">
                                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                               
                                                <div className="bg-[#c4a59d] px-2 py-2 text-xs text-white flex items-center justify-between">
                                                    <div className="">交易編號: {group.transactionId ?? txnId ?? ''}</div>
                                                    {group.receiptUrl ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs px-2 py-1 text-white !border-white/30 !bg-white/10"
                                                            onClick={() => window.open(group.receiptUrl as string, '_blank', 'noopener,noreferrer')}
                                                        >
                                                            查看入數證明
                                                        </Button>
                                                    ) : null}
                                                </div>

                                                <div className="p-1">
                                                    {group.orders.map((card: any) => (
                                                        <div key={card.orderNumber} className="bg-white rounded-md">
                                                            <div className="px-1 ">
                                                                <div className="mt-2 text-[10px] font-medium text-gray-700">訂單 #{card.orderNumber}</div>
                                                               
                                                                {(card.active && card.active.length > 0) ? card.active.map((r: any) => (
                                                                    <div key={r.id} className="mb-3">
                                                                        <div className="bg-white rounded-md overflow-hidden">
                                                                            <div className="p-3">
                                                                                <div className=" flex items-start gap-4">
                                                                                    <div className={`${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''} flex items-center gap-4 flex-1 min-w-0`}> 
                                                                                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                                                                            {(r.imageUrl || (r as any).thumbnail_url) ? (
                                                                                                <img
                                                                                                    src={r.imageUrl ?? (r as any).thumbnail_url}
                                                                                                    alt={r.sku}
                                                                                                    className="w-full h-full object-cover flex justify-start cursor-pointer"
                                                                                                    role="button"
                                                                                                    tabIndex={0}
                                                                                                    onClick={() => setExpandedImage(String(r.imageUrl ?? (r as any).thumbnail_url))}
                                                                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedImage(String(r.imageUrl ?? (r as any).thumbnail_url)) }}
                                                                                                />
                                                                                            ) : (
                                                                                                <div className="w-full h-full flex items-center justify-start text-sm text-gray-400">無圖</div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="text-sm font-semibold">{r.sku}</div>
                                                                                            <div className="text-xs text-gray-500 mt-1">{r.variation} <span className="text-gray-400">x{(r as any).quantity ?? 1}</span>
                                                                                                {(r as any).remark ? (<span className="text-[9px] text-gray-500 ml-2">備註: {(r as any).remark}</span>) : null}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex flex-col items-end w-28 gap-4">
                                                                                        <div style={{ filter: 'none', opacity: 1 }}><OrderStatusBadge status={r.status} /></div>
                                                                                        <div className={`${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''} text-sm font-bold mt-1`}>{typeof r.price === 'number' ? `$ ${r.price}` : ((r as any).price ? `$ ${(r as any).price}` : '')}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )) : (
                                                                    <div className="py-3 text-sm text-gray-500">沒有活躍項目</div>
                                                                )}

                                                                {(card.historical || []).length > 0 ? (
                                                                    <div className="mt-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setCollapsedOrders(prev => ({...prev, [card.orderNumber]: !prev[card.orderNumber]}))}
                                                                            className="text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            {collapsedOrders[card.orderNumber] ? `顯示歷史訂單 (${card.historical.length})` : `隱藏歷史訂單 (${card.historical.length})`}
                                                                        </button>
                                                                        {!collapsedOrders[card.orderNumber] ? (
                                                                            <div className="mt-2 space-y-2">
                                                                                {card.historical.map((r: any) => (
                                                                                    <div key={r.id} className="p-2 bg-gray-50 rounded-md text-sm text-gray-700">
                                                                                        <div className="flex items-start gap-3">
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <div className="font-medium">{r.sku} <span className="text-gray-500 text-xs">x{r.quantity}</span></div>
                                                                                                <div className={`${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''} text-xs text-gray-500`}>{r.variation}</div>
                                                                                            </div>
                                                                                            <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                                                                                {(r.imageUrl) ? (
                                                                                                    <img
                                                                                                        src={r.imageUrl}
                                                                                                        alt={r.sku}
                                                                                                        className="w-full h-full object-cover cursor-pointer"
                                                                                                        role="button"
                                                                                                        tabIndex={0}
                                                                                                        onClick={() => setExpandedImage(String(r.imageUrl))}
                                                                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedImage(String(r.imageUrl)) }}
                                                                                                    />
                                                                                                ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">無圖</div>}
                                                                                            </div>
                                                                                            <div className="flex flex-col items-end text-right text-sm font-medium">
                                                                                                <div style={{ filter: 'none', opacity: 1 }}><OrderStatusBadge status={r.status} /></div>
                                                                                                <div className={`${isCancelledStatus(r.status) ? 'opacity-50 grayscale pointer-events-none' : ''} mt-1`}>{typeof r.price === 'number' ? `$ ${r.price}` : ''}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                })()}
                             </div>
                         )}
                 </div>
                {/* Footer: totals and payment info */}
                <div className="bg-white border-t border-gray-100 px-4 py-3">
                    <div className="flex items-start justify-between text-md font-bold text-gray-900 mt-3">
                        <div>已付總額: {totalToPay !== null ? `$ ${totalToPay}` : '-'}</div>
                        <div className="flex items-start gap-3">
                            <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs px-2 py-1"
                                onClick={batchShipTransaction}
                                disabled={!txnId && !whatsappContact}
                            >
                                批量標記已出貨
                            </Button>
                            {/* moved per-transaction receipt button into the group header */}
                        </div>
                    </div>
                    {paymentDeadline ? (
                        <div className="text-xs text-gray-500 mt-2">付款截止: {paymentDeadline}</div>
                    ) : null}
                </div>
                {expandedImage ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setExpandedImage(null)}>
                        <div className="max-w-[90vw] max-h-[90vh] p-4">
                            <img
                                src={expandedImage}
                                alt="預覽"
                                className="max-w-full max-h-[80vh] rounded-md shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <button
                            aria-label="Close preview"
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-6 right-6 bg-white/90 rounded-full p-2 text-lg"
                        >
                            ×
                        </button>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
