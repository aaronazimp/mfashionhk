"use client"

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
  ExternalLink, CreditCard, Archive, Undo, ZoomIn, Banknote 
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

// Expanded Action Types for full lifecycle management
type ActionType = 'confirm' | 'out-of-stock' | 'verify' | 'archive' | 'undo' | 'void' | 'resend' | 'force-pay' | 'mark-paid'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  // Renamed to indicate these are just the ones passed from parent (optimistic)
  initialItems: Registration[]
  product?: any
  // Updated signature to handle all action types with toast suppression
  onAction: (r: Registration, type: ActionType, options?: { skipRedirect?: boolean, statusOverride?: string, suppressToast?: boolean }) => void
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
      return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 gap-1"><XCircle className="w-3 h-3" /> 已取消</Badge>
    case 'out-of-stock':
      return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 gap-1"><XCircle className="w-3 h-3" /> 缺貨</Badge>
    default:
      return <Badge variant="outline" className="text-gray-500 border-gray-200">{status}</Badge>
  }
}

const actionToChinese: Record<string, string> = {
  'confirm': '確認訂單',
  'out-of-stock': '標記缺貨',
  'verify': '核對收款',
  'archive': '歸檔',
  'undo': '撤銷操作',
  'void': '取消訂單',
  'resend': '補發通知',
  'force-pay': '標記付款',
  'mark-paid': '手動收款'
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
  const { toast } = useToast()
  const [processingState, setProcessingState] = useState<{ id: string, action: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [expandedVariations, setExpandedVariations] = React.useState<Record<string, boolean>>({})
  
  // Real items state (initialized with props, then fetched)
  const [items, setItems] = useState<Registration[]>(initialItems)
  const [loading, setLoading] = useState(false)

  // Sync props to state if props change (optimistic update support)
  // We only reset when SKU changes or if parent provides newer data (e.g. from realtime)
  useEffect(() => {
    setItems(initialItems)
  }, [sku, initialItems]) 

  // Fetch full list on open
  useEffect(() => {
    if (open && sku) {
      const fetchAll = async () => {
        setLoading(true)
        const { data } = await supabase
          .from('reels_orders')
          .select(`
            *,
            price,
            SKU_details (
              regular_price,
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
  
  // Verification Dialog State
  const [verifyingItem, setVerifyingItem] = useState<Registration | null>(null)

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
        case 'completed': return items.filter(i => ['verified', 'completed', 'void', 'out-of-stock'].includes(i.status))
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
    
    // Detailed breakdown for voided
    const cancelled = items.filter(i => i.status === 'void').length
    const outOfStock = items.filter(i => i.status === 'out-of-stock').length

    return { total, completed, verifying, unpaid, waitlist, voided, cancelled, outOfStock }
  }, [items])

  const { total, completed, verifying, unpaid, waitlist, voided, cancelled, outOfStock } = stats
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
    const prevStatus = r.status
    setProcessingState({ id: r.id, action: type })
    
    // Cloud Sync (with toast suppression)
    onAction(r, type, { suppressToast: true })

    // Local Optimistic Update
    setItems((prev) => prev.map((item) => {
        if (item.id !== r.id) return item;

        let s = item.status;
        if (type === 'confirm') s = 'confirmed';
        else if (type === 'out-of-stock') s = 'out-of-stock';
        else if (type === 'verify') s = 'verified';
        else if (type === 'void') s = 'void';
        else if (type === 'archive') s = 'completed';
        else if (type === 'force-pay') s = 'paid';
        else if (type === 'mark-paid') s = 'verified';

        return { ...item, status: s, adminAction: type as any };
    }));

    // Toast with Undo
    if (type === 'mark-paid') {
        toast({
            title: "已標記為收款完成",
            description: "訂單已直接跳轉至已完成狀態。",
            duration: 8000,
            action: (
                <ToastAction 
                    altText="撤銷" 
                    onClick={() => handleUndo(r, prevStatus)}
                    className="bg-gray-800 text-white hover:bg-gray-700 border-none flex items-center gap-2 px-3"
                >
                    <Undo className="w-3 h-3" />
                    撤銷
                </ToastAction>
            ),
        })
    } else {
        toast({
            title: "已更新",
            description: `${r.customerName} 的訂單操作: ${actionToChinese[type] || type}`,
            duration: 8000,
            action: (
                <ToastAction 
                    altText="撤銷" 
                    onClick={() => handleUndo(r, prevStatus)}
                    className="bg-gray-800 text-white hover:bg-gray-700 border-none flex items-center gap-2 px-3"
                >
                    <Undo className="w-3 h-3" />
                    撤銷
                </ToastAction>
            ),
        })
    }

    // Simulate API delay for UX
    setTimeout(() => {
        setProcessingState(null)
    }, 400)
  }

  const handleUndo = (r: Registration, oldStatus: Registration['status']) => {
      // 1. Optimistic Revert
      setItems((prev) => prev.map((item) => {
          if (item.id !== r.id) return item;
          return { ...item, status: oldStatus };
      }));

      // 2. Cloud Revert
      onAction(r, 'undo', { skipRedirect: true, statusOverride: oldStatus });

      toast({
          title: "已撤銷",
          description: "訂單狀態已恢復",
      })
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
    window.open(`https://wa.me/852${phone}?text=${encodeURIComponent(text)}`, '_blank')

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

  const renderVerificationDialog = () => {
    if (!verifyingItem) return null;
    return (
      <Dialog open={!!verifyingItem} onOpenChange={(o) => !o && setVerifyingItem(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
             <div className="flex-1 overflow-y-auto p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <ZoomIn className="w-5 h-5 text-gray-500" />
                        核對付款證明
                    </DialogTitle>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                             <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> 訂單資料
                             </h4>
                             <div className="grid grid-cols-2 gap-y-2 text-sm">
                                 <span className="text-gray-500">顧客:</span>
                                 <span className="font-medium text-right">{verifyingItem.customerName}</span>
                                 
                                 <span className="text-gray-500">電話:</span>
                                 <span className="font-mono text-right">{verifyingItem.whatsapp}</span>
                                 
                                 <span className="text-gray-500">商品:</span>
                                 <span className="text-right truncate">{verifyingItem.sku}</span>
                                 
                                 <span className="text-gray-500">規格:</span>
                                 <Badge variant="outline" className="w-fit justify-self-end">{verifyingItem.variation}</Badge>

                                 <div className="col-span-2 border-t border-gray-200 my-2"></div>
                                 
                                 <span className="text-gray-900 font-bold">應付金額:</span>
                                 <span className="text-xl font-bold text-green-600 text-right">
                                    {verifyingItem.price != null ? `$${verifyingItem.price}` : '未設定'}
                                 </span>
                             </div>
                         </div>
                         
                         {/* Button removed as requested */}
                    </div>

                    <div 
                        className="flex flex-col items-center justify-center bg-gray-100 rounded-lg border border-gray-200 overflow-hidden min-h-[300px] relative cursor-zoom-in"
                        onClick={() => verifyingItem.paymentProofUrl && setPreviewProof(verifyingItem.paymentProofUrl)}
                    >
                        {verifyingItem.paymentProofUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                                src={verifyingItem.paymentProofUrl} 
                                alt="Proof" 
                                className="w-full h-full object-contain absolute inset-0 transition-transform hover:scale-105"
                            />
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8" />
                                <span>無付款圖片</span>
                            </div>
                        )}
                    </div>
                </div>
             </div>

             <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                  <Button variant="ghost" onClick={() => setVerifyingItem(null)}>
                      {verifyingItem.status === 'paid' ? '暫不處理' : '關閉'}
                  </Button>
                  {verifyingItem.status === 'paid' && (
                      <Button 
                        className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                        onClick={() => {
                            handleAction(verifyingItem, 'verify');
                            setVerifyingItem(null);
                        }}
                      >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          確認收款
                      </Button>
                  )}
             </div>
        </DialogContent>
      </Dialog>
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
                    <span className="font-bold text-gray-700 text-sm">{variation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white text-gray-500 hover:bg-white">{its.length}</Badge>
                  <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expanded && (
                <div className="flex flex-col px-4 bg-white border-t border-gray-100">
                  {its.map((r) => (
                    <div key={r.id} className={`flex gap-3 py-4 border-b border-gray-100 last:border-0 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50/30 -mx-4 px-4' : 'hover:bg-gray-50 -mx-4 px-4'}`}>
                      <div className="pt-1">
                        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelection(r.id)} />
                      </div>
      {renderVerificationDialog()}
                      
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                             <div className="flex flex-col gap-2">
                                   <div className="flex items-center gap-2">
                                       {renderStatus(r.status)}
                                       {/* Order Number */}
                                       <span className="text-xs font-mono text-gray-500">#{r.orderNumber}</span>
                                   </div>
                                   <span className="font-bold text-sm text-gray-900 leading-tight">{r.customerName}</span>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                   <span className="text-xs text-gray-400 flex items-center" title={formatTime(r.timestamp)}>
                                        <Clock className="w-3 h-3 mr-1" />
                                        {formatDistanceToNow(r.timestamp, { addSuffix: true, locale: zhTW })}
                                   </span>

                                   {(['confirmed', 'in-stock', 'paid'].includes(r.status)) && (
                                       <button 
                                            className="ml-1 p-1.5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleAction(r, 'void'); }}
                                       >
                                            <X size={16} />
                                       </button>
                                   )}
                             </div>
                        </div>

                        <div className="mb-2">
                             <a href={`https://wa.me/852${r.whatsapp.replace(/\D/g,'')}`} target="_blank" className="text-xs text-gray-500 flex items-center hover:text-gray-900 transition-colors">
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mr-1.5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> {r.whatsapp}
                             </a>
                        </div>

                        <div>
                            {(r.status === 'waitlist' || r.status === 'pending') && (
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-9" onClick={() => handleAction(r, 'out-of-stock')}>
                                        <XCircle className="w-4 h-4 mr-1.5" /> 缺貨
                                    </Button>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-9" onClick={() => handleAction(r, 'confirm')}>
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> 確認
                                    </Button>
                                </div>
                            )}

                            {r.status === 'paid' && (
                                <Button 
                                    size="sm" 
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9 mt-1"
                                    onClick={() => setVerifyingItem(r)}
                                    disabled={!!processingState}
                                >
                                    {processingState?.id === r.id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
                                    核對收款
                                </Button>
                            )}

                            {(r.status === 'confirmed' || r.status === 'in-stock') && (
                                <div className="flex gap-2 mt-1">
                                    <Button size="sm" variant="outline" className="flex-1 border-gray-200 h-8 text-xs" onClick={() => handleAction(r, 'resend')}>
                                        <Send className="w-3.5 h-3.5 mr-1.5" /> 補發付款連結
                                    </Button>
                                    <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs" onClick={() => handleAction(r, 'mark-paid')}>
                                        <Banknote className="w-3.5 h-3.5 mr-1.5" /> 已收款
                                    </Button>
                                </div>
                            )}

                             {(['verified', 'completed', 'void', 'out-of-stock'].includes(r.status)) && (
                                 <div className="mt-1">
                                    {(['verified', 'completed'].includes(r.status)) && r.paymentProofUrl && (
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="w-full h-8 text-xs text-gray-600 border-gray-200"
                                            onClick={() => setVerifyingItem(r)}
                                        >
                                            <Eye className="w-3.5 h-3.5 mr-1.5" /> 查看付款證明
                                        </Button>
                                     )}
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
                  已處理
                  {(completed + voided) > 0 && <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold min-w-[18px]">{completed + voided}</span>}
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
      <DialogContent 
        showCloseButton={false} 
        className="p-0 gap-0 w-full h-[100dvh] sm:h-[95vh] sm:max-w-3xl flex flex-col overflow-hidden duration-200"
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            // Prevent close when clicking on toasts
            if (target.closest('[role="status"]') || target.closest('li[data-state]')) {
                e.preventDefault();
            }
        }}
      >
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
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 w-full">
                        <span>{items.length} 訂單</span>
                        {timeLeftStr === '已截止' ? (
                            <span className="ml-auto flex items-center gap-1.5 text-red-600 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                已截止
                            </span>
                        ) : (
                            <>
                                <span>•</span>
                                <span className={skuStatus === '已截單' ? 'text-red-500 font-medium' : 'text-green-600'}>{timeLeftStr}</span>
                            </>
                        )}
                    </div>
                </div>
                <DialogClose className="p-2 -mr-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </DialogClose>
            </div>

            {/* Progress Bar */}
            {(total > 0) && (
                <div className="px-4 pb-3">
                   <div className="w-full h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                      {/* Completeness Bar: Green for all processed items (Success + Void) */}
                      <div style={{ width: `${((completed + voided) / total) * 100}%` }} className="bg-green-500 transition-all duration-500" />
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] font-medium text-gray-500">
                       {/* Summary Statistic */}
                       <span className="font-bold text-gray-900 mr-2">
                          已處理: {Math.round(((completed + voided) / total) * 100)}%
                       </span>

                       {/* Ordered Legend - Only show processed breakdown */}
                       {completed > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {completed} 已完成</span>}
                       {outOfStock > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-400" /> {outOfStock} 缺貨</span>}
                       {cancelled > 0 && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-300" /> {cancelled} 取消</span>}
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