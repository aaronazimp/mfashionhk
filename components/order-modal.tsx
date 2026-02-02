"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useIsMobile } from '@/hooks/use-mobile'
import { type Registration, mapSupabaseOrderToRegistration } from '@/lib/orders'
import { Button } from './ui/button'
import { supabase } from "@/lib/supabase"
import { 
  ChevronDownIcon, MessageCircle, Loader2, Send, ArrowRight, 
  CheckCircle2, Clock, AlertCircle, Eye, CheckCircle, XCircle, X,
  ExternalLink, CreditCard, Archive, Undo, ZoomIn 
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

// Expanded Action Types for full lifecycle management
type ActionType = 'confirm' | 'out-of-stock' | 'verify' | 'archive' | 'undo' | 'void' | 'resend' | 'force-pay'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  // Renamed to indicate these are just the ones passed from parent (optimistic)
  initialItems: Registration[]
  product?: any
  // Updated signature to handle all action types
  onAction: (r: Registration, type: ActionType, options?: { skipRedirect?: boolean }) => void
  formatTime: (d: Date) => string
}

// UI Helper: Status Badges
const renderStatus = (status: string) => {
  const s = status.toLowerCase()
  switch (s) {
    case 'waitlist':
    case 'pending':
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 gap-1"><Clock className="w-3 h-3" /> 候補中</Badge>
    case 'confirmed':
    case 'in-stock':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 gap-1"><AlertCircle className="w-3 h-3" /> 待付款</Badge>
    case 'paid':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 gap-1 px-3 py-0.5 font-bold shadow-sm"><Eye className="w-3 h-3" /> 待核對</Badge>
    case 'verified':
    case 'completed':
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle className="w-3 h-3" /> 已完成</Badge>
    case 'void':
    case 'out-of-stock':
      return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 gap-1"><XCircle className="w-3 h-3" /> 已取消</Badge>
    default:
      return <Badge variant="outline" className="text-gray-500 border-gray-200">{status}</Badge>
  }
}

const statusPriority: Record<string, number> = {
  'paid': 0,        // Action Needed (Top)
  'confirmed': 1,   // Awaiting Payment
  'in-stock': 1,
  'waitlist': 2,    // Queue
  'pending': 2,
  'verified': 3,    // Done
  'completed': 3,
  'void': 4,        // Dead
  'out-of-stock': 4
}

export default function OrderModal({ open, onOpenChange, sku, initialItems, product, onAction, formatTime }: Props) {
  const isMobile = useIsMobile()
  const [processingState, setProcessingState] = useState<{ id: string, action: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [expandedVariations, setExpandedVariations] = React.useState<Record<string, boolean>>({})
  
  // Real items state (initialized with props, then fetched)
  const [items, setItems] = useState<Registration[]>(initialItems)
  const [loading, setLoading] = useState(false)

  // Sync props to state if props change (optimistic update support)
  // We only reset when SKU changes, not when parent data updates, to avoid overwriting full fetched list with partial page list
  useEffect(() => {
    setItems(initialItems)
  }, [sku]) // Only reset on SKU switch

  // Fetch full list on open
  useEffect(() => {
    if (open && sku) {
      const fetchAll = async () => {
        setLoading(true)
        const { data } = await supabase
          .from('reels_orders')
          .select(`
            *,
            SKU_details (
              SKU_date,
              reels_deadline,
              SKU_images (
                imageurl,
                imageIndex
              )
            )
          `)
          .eq('sku_code_snapshot', sku)
          .order('created_at', { ascending: false });
        
        if (data) {
           setItems(data.map(mapSupabaseOrderToRegistration))
        }
        setLoading(false)
      }
      fetchAll()
    }
  }, [open, sku])
  
  // Image Preview State
  const [previewProof, setPreviewProof] = useState<string | null>(null)

  // Batch Mode State
  const [batchMode, setBatchMode] = useState(false)
  const [batchQueue, setBatchQueue] = useState<Registration[]>([])
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0)
  const [batchAction, setBatchAction] = useState<ActionType>('confirm')
  const [messageTemplate, setMessageTemplate] = useState("")
  const listRef = React.useRef<HTMLDivElement>(null)

  // Initial Setup
  useEffect(() => {
    if (open) {
       let defaultTab = 'waitlist'
       const hasPaid = items.some(i => i.status === 'paid')
       const hasConfirmed = items.some(i => ['confirmed', 'in-stock'].includes(i.status))
       const hasWait = items.some(i => ['waitlist', 'pending'].includes(i.status))
       const hasDone = items.some(i => ['verified', 'completed'].includes(i.status))

       if (hasPaid) defaultTab = 'paid'
       else if (hasConfirmed) defaultTab = 'confirmed'
       else if (hasWait) defaultTab = 'waitlist'
       else if (hasDone) defaultTab = 'completed'

       setActiveTab(defaultTab)
       setSelectedIds(new Set())
       
       // Expand all variations by default
       const init: Record<string, boolean> = {}
       Array.from(new Set(items.map(i => i.variation))).forEach((k) => (init[k] = true))
       setExpandedVariations(init)
    }
  }, [open, items])

  // Filter Logic
  const filteredItems = React.useMemo(() => {
    switch(activeTab) {
        case 'paid': return items.filter(i => i.status === 'paid')
        case 'confirmed': return items.filter(i => ['confirmed', 'in-stock'].includes(i.status))
        case 'waitlist': return items.filter(i => ['waitlist', 'pending'].includes(i.status))
        case 'completed': return items.filter(i => ['verified', 'completed'].includes(i.status))
        default: return items
    }
  }, [items, activeTab])

  // Grouping Logic
  const itemsByVariation = React.useMemo(() => {
    return filteredItems.reduce((acc: Record<string, Registration[]>, it) => {
      if (!acc[it.variation]) acc[it.variation] = []
      acc[it.variation].push(it)
      return acc
    }, {})
  }, [filteredItems])

  // Timer Logic
  const deadline = React.useMemo(() => {
    // If product passed down has deadline, use it, else default
    return items[0]?.reelsDeadline ? new Date(items[0].reelsDeadline) : new Date(Date.now() + 3600000)
  }, [items])

  const [timeLeftStr, setTimeLeftStr] = useState("")
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, deadline.getTime() - Date.now())
      if (diff <= 0) { setTimeLeftStr('已截止'); return }
      
      const d = Math.floor(diff / (1000 * 60 * 60 * 24))
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)
      
      const pad = (n: number) => n.toString().padStart(2, '0')
      
      let str = ""
      if (d > 0) str += `${d}日`
      str += `${pad(h)}時${pad(m)}分${pad(s)}秒`
      
      setTimeLeftStr(`剩餘: ${str}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  const skuStatus = items.some((it) => it.status === 'pending' || it.status === 'waitlist') ? '收單中' : '已截單'

  // Stats for Progress Bar
  const stats = React.useMemo(() => {
    const total = items.length
    const completed = items.filter(i => ['verified', 'completed'].includes(i.status)).length
    const verifying = items.filter(i => i.status === 'paid').length
    const unpaid = items.filter(i => ['confirmed', 'in-stock'].includes(i.status)).length
    // In Modal logic, 'pending' is grouped with waitlist (see renderStatus and tabs).
    // This differs slightly from page.tsx where pending might be in unpaid, but we stick to modal consistency here.
    const waitlist = items.filter(i => ['waitlist', 'pending'].includes(i.status)).length
    const voided = items.filter(i => ['void', 'out-of-stock'].includes(i.status)).length

    return { total, completed, verifying, unpaid, waitlist, voided }
  }, [items])

  const { total, completed, verifying, unpaid, waitlist, voided } = stats
  const pCompleted = total > 0 ? (completed / total) * 100 : 0
  const pVerifying = total > 0 ? (verifying / total) * 100 : 0
  const pUnpaid = total > 0 ? (unpaid / total) * 100 : 0
  const pWaitlist = total > 0 ? (waitlist / total) * 100 : 0
  const pVoid = total > 0 ? (voided / total) * 100 : 0

  // Derived Display Image
  // Use the image from the first item (which contains SKU_details from DB) if available
  // otherwise fallback to product prop
  const displayImage = items[0]?.imageUrl || product?.images?.[0]

  // --- Handlers ---

  const handleAction = (r: Registration, type: ActionType) => {
    if (processingState) return
    setProcessingState({ id: r.id, action: type })
    
    // Cloud Sync
    onAction(r, type)

    // Local Optimistic Update
    setItems((prev) => prev.map((item) => {
        if (item.id !== r.id) return item;

        let s = item.status;
        if (type === 'confirm') s = 'in-stock';
        else if (type === 'out-of-stock') s = 'out-of-stock';
        else if (type === 'verify') s = 'verified';
        else if (type === 'void') s = 'void';
        else if (type === 'archive') s = 'completed';
        else if (type === 'undo') s = 'pending';

        return { ...item, status: s, adminAction: type as any };
    }));

    // Simulate API delay for UX
    setTimeout(() => {
        setProcessingState(null)
    }, 400)
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
       const next = new Set(prev)
       if (allSelected) ids.forEach(id => next.delete(id))
       else ids.forEach(id => next.add(id))
       return next
    })
  }

  // --- Batch Logic ---

  const startBatchProcess = (type: ActionType) => {
    const queue = items.filter(i => selectedIds.has(i.id))
    if (queue.length === 0) return

    // Template Logic
    let tmpl = ""
    if (type === 'confirm') tmpl = "您好 {{name}}，您的訂單 {{sku}} ({{variation}}) 已確認。請於24小時內完成付款。若需付款資料或支付連結，請回覆本訊息。謝謝！"
    else if (type === 'out-of-stock') tmpl = "您好 {{name}}，很抱歉，商品 {{sku}} ({{variation}}) 目前缺貨。如需退款或等待補貨，請告訴我們。"
    else if (type === 'verify') tmpl = "您好 {{name}}，我們已收到您的付款證明並確認訂單 {{sku}}。貨品寄出時會再通知您，謝謝！"
    
    setMessageTemplate(tmpl)
    setBatchQueue(queue)
    setCurrentBatchIndex(0)
    setBatchAction(type)
    setBatchMode(true)
  }

  const processCurrentAndNext = () => {
    const currentItem = batchQueue[currentBatchIndex]
    if (!currentItem) return

    // 1. WhatsApp
    const text = messageTemplate
        .replace(/{{name}}/g, currentItem.customerName)
        .replace(/{{sku}}/g, sku || '')
        .replace(/{{variation}}/g, currentItem.variation)
    const phone = currentItem.whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')

    // 2. Action
    onAction(currentItem, batchAction, { skipRedirect: true })

    // 3. Next
    if (currentBatchIndex < batchQueue.length - 1) setCurrentBatchIndex(prev => prev + 1)
    else { setBatchMode(false); setSelectedIds(new Set()); setBatchQueue([]) }
  }

  // Keyboard shortcut for batch
  useEffect(() => {
    if (!batchMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') { e.preventDefault(); processCurrentAndNext(); }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [batchMode, currentBatchIndex])

  // --- Renders ---

  const renderBatchMode = () => {
    const currentItem = batchQueue[currentBatchIndex]
    if (!currentItem) return null // Should show completion screen logically

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 items-center justify-center min-h-[500px]">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl p-6 space-y-6">
                 <div className="space-y-2 text-center">
                    <h3 className="text-gray-500 text-sm uppercase tracking-wider font-semibold">批量處理中</h3>
                    <Progress value={((currentBatchIndex) / batchQueue.length) * 100} className="h-2" />
                    <p className="text-xs text-gray-400">{currentBatchIndex + 1} / {batchQueue.length}</p>
                 </div>

                 <div className="py-4 border-y border-gray-100 text-center space-y-2">
                    <Badge variant="outline" className="text-lg px-3 py-1">{currentItem.variation}</Badge>
                    <h2 className="text-2xl font-bold text-gray-900">{currentItem.customerName}</h2>
                    <p className="font-mono text-gray-500">{currentItem.whatsapp}</p>
                 </div>

                 <div className="space-y-3">
                    <Button 
                       size="lg"
                       className={`w-full h-14 text-lg shadow-lg ${batchAction === 'confirm' || batchAction === 'verify' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                       onClick={processCurrentAndNext}
                    >
                       <Send className="w-5 h-5 mr-2" />
                       發送並跳轉 (Space)
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setCurrentBatchIndex(prev => prev + 1)}>跳過</Button>
                 </div>
                 <Button variant="link" className="w-full text-xs text-gray-400" onClick={() => setBatchMode(false)}>退出批量模式</Button>
            </div>
        </div>
    )
  }

  const renderOrderList = () => (
      <div ref={listRef} className={isMobile ? 'h-full overflow-y-auto pb-32 px-3' : 'h-full overflow-y-auto pb-24 px-1 space-y-4'}>
        {filteredItems.length > 0 && selectedIds.size < filteredItems.length && (
            <div className="sticky top-0 z-10 bg-gray-50/95 py-2 px-1 backdrop-blur-sm flex justify-end border-b border-gray-200/50 mb-2">
                <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 bg-white border-gray-200 text-gray-700 hover:bg-gray-100 shadow-sm"
                    onClick={() => {
                        const all = filteredItems.map(i => i.id)
                        setSelectedIds(new Set(all))
                        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                    批量處理 ({filteredItems.length})
                </Button>
            </div>
        )}
        {Object.entries(itemsByVariation).length === 0 ? (
           <div className="flex h-40 items-center justify-center text-gray-400">沒有相關訂單</div>
        ) : Object.entries(itemsByVariation).map(([variation, rawIts]) => {
          // Sort logic: Action Needed (Paid) > Unpaid > Queue > Done
          const its = [...rawIts].sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99))
          const expanded = !!expandedVariations[variation]
          const groupIds = its.map(i => i.id)
          const allSelected = groupIds.every(id => selectedIds.has(id))
          const someSelected = groupIds.some(id => selectedIds.has(id))
          
          return (
            <div key={variation} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3 shadow-sm shrink-0">
              <div 
                className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedVariations(prev => ({ ...prev, [variation]: !prev[variation] }))}
              >
                <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={allSelected || (someSelected && "indeterminate")} onCheckedChange={() => toggleGroup(groupIds)} />
                    </div>
                    <span className="font-bold text-gray-700">{variation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white text-gray-500 hover:bg-white">{its.length}</Badge>
                  <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expanded && (
                <div className="flex flex-col">
                  {its.map((r) => (
                    <div key={r.id} className={`flex gap-3 px-4 py-6 border-b border-gray-100 last:border-0 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                      <div className="pt-1">
                        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelection(r.id)} />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        {/* 1. Header Row: Status | Time | Void (X) */}
                        <div className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-2">
                                   {renderStatus(r.status)}
                             </div>
                             
                             <div className="flex items-center gap-2">
                                   <span className="text-xs text-gray-400 flex items-center" title={formatTime(r.timestamp)}>
                                        <Clock className="w-3 h-3 mr-1" />
                                        {formatDistanceToNow(r.timestamp, { addSuffix: true, locale: zhTW })}
                                   </span>

                                   {/* Void Action Button */}
                                   {(['waitlist', 'pending', 'confirmed', 'in-stock', 'paid'].includes(r.status)) && (
                                           <Button 
                                              size="sm"
                                              variant="outline"
                                              className="h-6 px-2 text-[10px] text-red-600 border-red-200 bg-white hover:bg-red-50 transition-all font-medium"
                                              onClick={() => handleAction(r, 'out-of-stock')}
                                              title="Cancel Order"
                                           >
                                              取消訂單
                                           </Button>
                                   )}
                             </div>
                        </div>

                        {/* 2. Customer Name Row */}
                        <div>
                             <span className="font-bold text-base text-gray-900">{r.customerName}</span>
                        </div>

                        {/* 3. WhatsApp Row */}
                        <div>
                             <a href={`https://wa.me/${r.whatsapp.replace(/\D/g,'')}`} target="_blank" className="text-sm text-gray-500 flex items-center hover:text-gray-900 transition-colors">
                                <MessageCircle className="w-4 h-4 mr-2" /> {r.whatsapp}
                             </a>
                        </div>

                        {/* 4. Action Buttons Row */}
                        <div className="pt-1">
                             {/* Decision Mode: Waitlist/Pending */}
                            {(r.status === 'waitlist' || r.status === 'pending') && (
                                <div className="grid grid-cols-2 gap-3">
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction(r, 'out-of-stock')}>
                                        <XCircle className="w-4 h-4 mr-1.5" /> 缺貨通知
                                    </Button>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={() => handleAction(r, 'confirm')}>
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> 番貨通知
                                    </Button>
                                </div>
                            )}

                             {/* Process Mode: Paid (Verify Only) */}
                            {r.status === 'paid' && (
                                <Button 
                                    size="sm" 
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                    onClick={() => handleAction(r, 'verify')}
                                    disabled={!!processingState}
                                >
                                    {processingState?.id === r.id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
                                    核對收款
                                </Button>
                            )}

                            {/* Process Mode: Confirmed (Resend Only) */}
                            {(r.status === 'confirmed' || r.status === 'in-stock') && (
                                <div className="flex gap-3">
                                    <Button size="sm" variant="outline" className="flex-1 border-gray-200" onClick={() => handleAction(r, 'resend')}>
                                        <Send className="w-4 h-4 mr-1.5" /> 補發連結
                                    </Button>
                                </div>
                            )}

                            {/* Completed Status */}
                            {(r.status === 'verified' || r.status === 'completed') && (
                                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-xs text-gray-500">
                                     <span className="flex items-center gap-1 text-green-600 font-medium">
                                        <CheckCircle2 className="w-3 h-3" /> 交易完成
                                     </span>
                                     <button className="text-gray-400 hover:text-gray-600 flex items-center gap-1" onClick={() => handleAction(r, 'undo')}>
                                        <Undo className="w-3 h-3" /> 重置
                                     </button>
                                </div>
                            )}

                            {/* Voided Status */}
                             {(r.status === 'void' || r.status === 'out-of-stock') && (
                                 <div className="flex items-center justify-between px-1">
                                    <span className="text-xs text-gray-400 flex items-center">已取消</span>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400" onClick={() => handleAction(r, 'undo')}>
                                        <Undo className="w-3 h-3 mr-1" /> 重還
                                     </Button>
                                 </div>
                             )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
  )

  const content = batchMode ? renderBatchMode() : (
    <div className="flex flex-col h-full bg-white">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1">
                <TabsTrigger value="paid" className="text-xs px-0 data-[state=active]:text-blue-700 data-[state=active]:font-bold">
                  待核對
                  {verifying > 0 && <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold min-w-[18px]">{verifying}</span>}
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-xs px-0 data-[state=active]:text-orange-700 data-[state=active]:font-bold">
                  待付款
                  {unpaid > 0 && <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold min-w-[18px]">{unpaid}</span>}
                </TabsTrigger>
                <TabsTrigger value="waitlist" className="text-xs px-0 data-[state=active]:text-purple-700 data-[state=active]:font-bold">
                  候補中
                  {waitlist > 0 && <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold min-w-[18px]">{waitlist}</span>}
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs px-0 data-[state=active]:text-green-700 data-[state=active]:font-bold">
                  已完成
                </TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="paid" className="flex-1 min-h-0 mt-2">{renderOrderList()}</TabsContent>
        <TabsContent value="confirmed" className="flex-1 min-h-0 mt-2">{renderOrderList()}</TabsContent>
        <TabsContent value="waitlist" className="flex-1 min-h-0 mt-2">{renderOrderList()}</TabsContent>
        <TabsContent value="completed" className="flex-1 min-h-0 mt-2">{renderOrderList()}</TabsContent>
      </Tabs>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-gray-900 text-white shadow-2xl rounded-2xl p-3 flex items-center justify-between z-50 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3">
                <div className="bg-gray-700 text-xs px-2 py-1 rounded-md font-mono">已選 {selectedIds.size} 筆</div>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-white" onClick={() => setSelectedIds(new Set())}>取消</Button>
            </div>
            <div className="flex items-center gap-2">
                 {/* Cancel / Out of Stock */}
                 {activeTab !== 'completed' && (
                     <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => startBatchProcess('out-of-stock')}>缺貨</Button>
                 )}

                 {/* Confirm Availability (Waitlist) */}
                 {(activeTab === 'waitlist' || activeTab === 'all') && (
                     <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-500" onClick={() => startBatchProcess('confirm')}>確認</Button>
                 )}

                 {/* Verify Payment (Paid) */}
                 {activeTab === 'paid' && (
                     <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-500" onClick={() => startBatchProcess('verify')}>核對</Button>
                 )}
            </div>
        </div>
      )}
    </div>
  )

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 w-full h-[100dvh] sm:h-[95vh] sm:max-w-3xl flex flex-col overflow-hidden duration-200">
         {/* Header */}
         <div className="bg-white z-10 border-b border-gray-100 flex flex-col">
            <div className="px-4 py-3 flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 cursor-zoom-in group"
                  onClick={() => displayImage && setPreviewProof(displayImage)}
                >
                    {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayImage} alt="SKU" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" />
                    ) : <div className="flex items-center justify-center h-full text-xs text-gray-300">N/A</div>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Link href={`/product/${items[0]?.skuId || product?.id}`} target="_blank" className="hover:underline decoration-gray-300 underline-offset-4 decoration-2">
                            <DialogTitle className="font-bold text-lg truncate leading-tight">{sku}</DialogTitle>
                        </Link>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${skuStatus === '收單中' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{skuStatus}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>{items.length} 訂單</span>
                        <span>•</span>
                        <span className={skuStatus === '已截單' ? 'text-red-500 font-medium' : 'text-green-600'}>{timeLeftStr}</span>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {(total > 0) && (
                <div className="px-4 pb-3">
                   <div className="w-full h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                      {pCompleted > 0 && <div style={{ width: `${pCompleted}%` }} className="bg-green-500" />}
                      {pVerifying > 0 && <div style={{ width: `${pVerifying}%` }} className="bg-blue-500 animate-pulse" />}
                      {pUnpaid > 0 && <div style={{ width: `${pUnpaid}%` }} className="bg-orange-400" />}
                      {pWaitlist > 0 && <div style={{ width: `${pWaitlist}%` }} className="bg-purple-400" />}
                      {pVoid > 0 && <div style={{ width: `${pVoid}%` }} className="bg-gray-200" />}
                   </div>
                   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] font-medium text-gray-500">
                       {completed > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {completed} 已完成</span>}
                       {verifying > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {verifying} 待核對</span>}
                       {unpaid > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-400" /> {unpaid} 待付款</span>}
                       {waitlist > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-400" /> {waitlist} 候補</span>}
                       {voided > 0 && <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-300" /> {voided} 已取消</div>}
                   </div>
                </div>
             )}
         </div>

         {/* Content */}
         <div className="flex-1 min-h-0 bg-gray-50/50">
            {content}
         </div>
      </DialogContent>
    </Dialog>

    {/* Lightbox for Payment Proof */}
    <Dialog open={!!previewProof} onOpenChange={(o) => !o && setPreviewProof(null)}>
        <DialogContent className="max-w-screen-md p-0 overflow-hidden bg-black/95 border-none">
            <DialogTitle className="sr-only">Payment Proof Preview</DialogTitle>
            <div className="relative w-full h-[80vh] flex items-center justify-center">
                {previewProof && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewProof} alt="Proof Fullscreen" className="max-w-full max-h-full object-contain" />
                )}
            </div>
        </DialogContent>
    </Dialog>
    </>
  )
}