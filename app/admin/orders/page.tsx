"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, Volume2, VolumeX } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { groupAndSortRegistrations, type Registration, mapSupabaseOrderToRegistration } from "@/lib/orders";
import Image from "next/image";
import { products } from "@/lib/products";
import OrderModal from '@/components/order-modal'
import { supabase } from "@/lib/supabase";

export default function OrdersPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [view, setView] = useState<"all" | "action_needed" | "completed">("action_needed");
  const [searchSku, setSearchSku] = useState<string>("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const ITEMS_PER_PAGE = 10;
  
  const [showAudioConsent, setShowAudioConsent] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cash register "Ka-Ching" sound
  const NOTIFICATION_SOUND = "https://www.myinstants.com/media/sounds/ka-ching.mp3";

  const { toast: pushToast } = useToast();
  const wakeLockRef = React.useRef<any>(null);

  // Fetch orders from Supabase
  useEffect(() => {
    const fetchOrders = async () => {
      // Fetch all for local filtering (since we need SKU grouping logic which is cross-row)
      // Note: Ideally we paginate, but for now we fetch range. 
      // Warning: The requested logic requires *group* level stats. 
      // If we page the input of groupAndSort, we might miss items for a SKU if they are split across pages.
      // However, keeping existing behavior of fetching one page of orders and grouping them.
      // Ideally we should group on backend or fetch more. for now we stick to existing fetch logic
      // but simplistic status filtering might be weird if an SKU has items on page 1 and page 2.
      // Assuming 'created_at' order keeps them somewhat together or user accepts page-by-page.
      
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching orders:", error);
        pushToast({
          title: "無法載入訂單",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setTotalCount(count || 0);

      if (data) {
        const mapped: Registration[] = data.map(mapSupabaseOrderToRegistration);
        setRegistrations(mapped);
      }
    };

    fetchOrders();
  }, [pushToast, page]);

  // Request a screen Wake Lock on mount and re-request on visibilitychange
  useEffect(() => {
    const requestLock = async () => {
      try {
        // @ts-ignore
        if ((navigator as any).wakeLock) {
          // @ts-ignore
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener?.('release', () => {
            // noop
          });
        }
      } catch (e) {
        // ignore
      }
    };

    const releaseLock = async () => {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch (e) {
        // ignore
      }
    };

    requestLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      releaseLock();
    };
  }, []);

  // no-op: wake lock is requested automatically and not persisted

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    if (diff < 1) return "剛剛";
    if (diff < 60) return `${diff} 分鐘前`;
    return `${Math.floor(diff / 60)} 小時前`;
  };

  // Group and sort using shared helper, but pass 'all' view to get raw groups, then filter locally
  const allGroups = useMemo(() => groupAndSortRegistrations(registrations, { view: 'all', searchSku }), [registrations, searchSku]);

  // Apply new Filter Logic
  const { filteredGroups, counts } = useMemo(() => {
    // 1. Calculate categories for all groups
    const classified = allGroups.map(g => {
      // Definition of completed: all items are in a terminal state
      const isAllCompleted = g.items.every(i => 
        ['verified', 'completed', 'void', 'out-of-stock'].includes(i.status)
      );

      const category = isAllCompleted ? 'completed' : 'action_needed';
      
      return { group: g, category };
    });

    // 2. Count
    const counts = {
      all: classified.length,
      action_needed: classified.filter(c => c.category === 'action_needed').length,
      completed: classified.filter(c => c.category === 'completed').length
    };

    // 3. Filter based on current view
    const filtered = classified.filter(c => {
      if (view === 'all') return true;
      return c.category === view;
    }).map(c => c.group);

    return { filteredGroups: filtered, counts };
  }, [allGroups, view]);
  
  const groups = filteredGroups;

  // WhatsApp helpers
  const buildWhatsappUrl = (phone: string, text: string) => {
    const pn = (phone || "").replace(/\D/g, "");
    const encoded = encodeURIComponent(text);
    return `https://wa.me/852${pn}?text=${encoded}`;
  };

  // Find product by matching digit-only SKU portions (orders use a different SKU format)
  const findProductForSku = (orderSku: string) => {
    const digits = (orderSku || "").replace(/\D/g, "");
    return products.find((p) => (p.sku || "").replace(/\D/g, "") === digits);
  };

  const sendWhatsapp = async (r: Registration, type: string, options?: { skipRedirect?: boolean, statusOverride?: string, suppressToast?: boolean }) => {
    const name = r.customerName ?? "顧客";
    const sku = r.sku ?? "";
    const variation = r.variation ?? "";
    let text = "";
    
    // Status Logic: Allow override or derive from action type
    let status = options?.statusOverride ?? r.status;
    const isOverride = !!options?.statusOverride;

    if (!isOverride) {
        if (type === "confirm") {
          text = `您好 ${name}，您的訂單 ${sku} (${variation}) 已確認。請於24小時內完成付款。若需付款資料或支付連結，請回覆本訊息。謝謝！`;
          status = "confirmed";
        } else if (type === "out-of-stock") {
          text = `您好 ${name}，很抱歉，您預約的商品 ${sku} (${variation}) 目前缺貨。如需退款或等待補貨，請告訴我們。造成不便敬請見諒。`;
          status = "out-of-stock";
        } else if (type === "verify") {
          text = `您好 ${name}，我們已收到您的付款證明並確認訂單 ${sku} (${variation})。貨品寄出時會再通知您，謝謝！`;
          status = "verified";
        } else if (type === "void") {
          status = "void";
        } else if (type === "archive") {
          status = "completed";
        } else if (type === "force-pay") {
          status = "paid";
        } else if (type === "mark-paid") {
          status = "verified";
        }
    }

    if (text) {
      const url = buildWhatsappUrl(r.whatsapp, text);
      if (!options?.skipRedirect) {
        try {
          window.open(url, "_blank");
        } catch (e) {
          window.location.href = url;
        }
      }
    }

    // DB Update
    if (isOverride || status !== r.status) {
        let updatePayload: any = { status: status }
        // For mark-paid (Manual Payment), we record extra metadata
        if (type === 'mark-paid') {
           updatePayload = {
               ...updatePayload,
               verified_at: new Date().toISOString(),
               payment_method: 'manual'
           }
        }
        
        const { error } = await supabase
            .from('reels_orders')
            .update(updatePayload)
            .eq('id', r.id);

        if (error) {
            console.error("Failed to update status", error);
            pushToast({
                title: "更新失敗",
                description: error.message,
                variant: "destructive",
            });
            return;
        }
    }

    // optimistic update: mark the single order as processed so user sees it's handled
    const updater = (prev: Registration[]) => prev.map((item) => {
        if (item.id !== r.id) return item;
        return { ...item, status: status as Registration['status'], adminAction: type as any };
    });

    setRegistrations(updater);

    if (!options?.suppressToast) {
        // Map types to Chinese - duplicating map here to avoid export issues
        const typeMap: Record<string, string> = {
            'confirm': '確認訂單', 'out-of-stock': '標記缺貨', 'verify': '核對收款', 
            'archive': '歸檔', 'undo': '撤銷操作', 'void': '取消訂單',
            'resend': '補發通知', 'force-pay': '標記付款', 'mark-paid': '手動收款'
        }
        pushToast({
            title: "已處理",
            description: `${name} 的訂單操作: ${typeMap[type] || type}`,
            open: true,
        });
    }
  };

  const toggleExpand = useCallback((sku: string) => {
    setSelectedSku(sku);
    setModalOpen(true);
  }, []);

  const collapseAll = () => {
    // close modal / deselect SKU
    setModalOpen(false);
    setSelectedSku(null);
  };

  // Live notification listener
  useEffect(() => {
    const channel = supabase
      .channel('reels_orders_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reels_orders' },
        async (payload) => {
          // 1. Play Sound
          if (audioEnabled && audioRef.current) {
             audioRef.current.currentTime = 0;
             audioRef.current.play().catch(e => console.error("Audio play failed", e));
          }

          const partialData = payload.new;
          
          // 2. Fetch full data to ensure we have joined tables (SKU_details etc)
          let newReg: Registration;
          const { data: fullData } = await supabase
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
            .eq('id', partialData.id)
            .single();
            
          if (fullData) {
              newReg = mapSupabaseOrderToRegistration(fullData);
          } else {
             // Fallback
             newReg = mapSupabaseOrderToRegistration(partialData);
          }

           // 3. Show Toast
           const sku = newReg.sku || '未知商品';
           const cust = newReg.customerName || '顧客';

           pushToast({
             title: `🔥 來自${cust}的新訂單`,
             description: `${sku} - ${newReg.variation ?? ''}`,
             duration: Infinity, 
             action: (
               <ToastAction altText="View" onClick={() => toggleExpand(sku)}>
                 查看
               </ToastAction>
             )
          });

          // 4. Update State
          setRegistrations((prev) => {
             // Avoid duplicates if multiple inserts happen quickly or optimistic updates clash
             if (prev.find(p => p.id === newReg.id)) return prev;
             return [newReg, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [audioEnabled, pushToast, toggleExpand]);

  return (
    <div className="min-h-screen bg-gray-50/50 text-[#111827]">
      {/* Header */}
          <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
         
          <nav className="inline-flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
            <Link href="/admin/orders" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm font-medium bg-[#C4A59D] text-white text-center md:text-left hover:bg-[#C4A59D]/90 transition-colors">處理訂單</Link>
            <Link href="/admin/upload" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">上傳 SKU</Link>
            <Link href="/admin/skus" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">管理 SKUs</Link>
            <Link href="/admin/best-sellers" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">熱賣 SKU</Link>
          </nav>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAudioConsent(true)}
            className="hidden md:flex text-gray-500 hover:text-gray-900 ml-4"
            title={audioEnabled ? "音效已開啟" : "音效已關閉"}
          >
            {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pb-24">

        <Card>
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-base md:text-lg mb-4">篩選/檢索</CardTitle>
            <div className="space-y-3 md:space-y-4">
              {/* View Tabs */}
              <div className="bg-gray-50 p-1 rounded-lg border border-gray-200 flex gap-1">
                <Button 
                  variant="ghost" 
                  onClick={() => setView("action_needed")} 
                  className={`flex-1 text-xs md:text-sm h-9 relative ${view === 'action_needed' ? 'bg-white text-blue-600 shadow-sm border border-gray-200 font-bold' : 'text-gray-500 hover:text-blue-600'}`}
                >
                  待處理
                  {counts.action_needed > 0 && (
                    <span className="ml-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">
                      {counts.action_needed}
                    </span>
                  )}
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => setView("completed")} 
                  className={`flex-1 text-xs md:text-sm h-9 relative ${view === 'completed' ? 'bg-white text-green-600 shadow-sm border border-gray-200 font-bold' : 'text-gray-500 hover:text-green-600'}`}
                >
                  已完成
                </Button>

                <Button 
                  variant={view === "all" ? "default" : "ghost"} 
                  onClick={() => setView("all")} 
                  className={`flex-1 text-xs md:text-sm h-9 ${view === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-200 hover:bg-gray-50' : 'text-gray-500'}`}
                >
                  全部
                </Button>
              </div>
              
              {/* Search and Controls */}
              <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-3">
                <div className="flex-1">
                  <Input placeholder="搜尋 SKU / 顧客 / 訂單號" value={searchSku} onChange={(e) => setSearchSku((e.target as HTMLInputElement).value)} className="text-sm" />
                </div>
                <div className="flex gap-2">
                 
                </div>
              </div>
            </div>
          </CardHeader>
          <Toaster />
          <CardContent className="pt-0">
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm md:text-base text-[#6B7280]">目前沒有符合的訂單。</div>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {groups.map((g, idx) => {
                  const firstItem = g.items[0];
                  const previewImage = firstItem.imageUrl;
                  const deadline = firstItem.reelsDeadline;
                  
                  // Stats
                  const total = g.items.length;
                  const verifying = g.items.filter(i => i.status === 'paid').length;
                  const processingCount = g.items.filter(i => !['verified', 'completed', 'void', 'out-of-stock'].includes(i.status)).length;
                  
                  // Traffic Light Logic
                  const isAllCompleted = g.items.every(i => 
                    ['verified', 'completed', 'void', 'out-of-stock'].includes(i.status)
                  );
                  
                  // Urgency Logic
                  const now = new Date();
                  const deadlineDate = deadline ? new Date(deadline) : null;
                  const isDeadlinePassed = deadlineDate ? deadlineDate < now : false;
                  const hoursLeft = deadlineDate ? (deadlineDate.getTime() - now.getTime()) / 3600000 : 0;
                  
                  // 1. Workflow Badge (Top Right)
                  let workflowBadge = null;
                  if (verifying > 0) {
                     workflowBadge = (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 shadow-sm whitespace-nowrap">
                         待核數 {verifying}
                       </span>
                     );
                  } else if (isAllCompleted) {
                     workflowBadge = (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-400 text-xs font-medium border border-gray-100 whitespace-nowrap">
                         已完成
                       </span>
                     );
                  }

                  // 2. Urgency Label (Always calculated)
                  let urgencyLabel = null;
                  if (isDeadlinePassed) {
                      urgencyLabel = (
                        <span className="text-red-600 text-[10px] md:text-xs font-bold whitespace-nowrap">
                          🔴 已截單
                        </span>
                      );
                  } else if (hoursLeft < 24 && deadlineDate) {
                      urgencyLabel = (
                        <span className="text-orange-600 text-[10px] md:text-xs font-bold whitespace-nowrap">
                           🟠 剩餘 {Math.ceil(hoursLeft)} 小時
                        </span>
                      );
                  } else {
                      urgencyLabel = (
                        <span className="text-green-600 text-[10px] md:text-xs font-bold whitespace-nowrap">
                           🟢 進行中
                        </span>
                      );
                  }

                  return (
                    <div 
                      key={g.sku} 
                      className="group relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex items-center h-24"
                      onClick={() => toggleExpand(g.sku)}
                    >
                        {/* Image */}
                        <div 
                          className="w-24 h-full bg-gray-100 relative overflow-hidden flex-shrink-0 border-r border-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (previewImage) setFullscreenImage(previewImage);
                          }}
                        >
                          {previewImage ? (
                            <Image src={previewImage} alt={g.sku} fill className="object-cover object-top" priority={idx < 5} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">無圖片</div>
                          )}
                        </div>
                        
                        {/* Info Section */}
                        <div className="flex-1 min-w-0 px-3 py-2 self-center">
                             <div className="flex flex-col gap-1">
                                 {/* Top Row: SKU + Urgency | Workflow Badge */}
                                 <div className="flex justify-between items-start gap-2">
                                     <div className="flex flex-col gap-0.5 min-w-0">
                                         <h3 className="text-base font-bold text-gray-900 leading-none truncate">
                                            {firstItem.skuId ? (
                                                <Link 
                                                  href={`/product/${firstItem.skuId}`}  
                                                  target="_blank"
                                                  onClick={(e) => e.stopPropagation()} 
                                                  className="hover:text-blue-600 transition-colors"
                                                >
                                                  {g.sku}
                                                </Link>
                                              ) : (
                                                g.sku
                                              )}
                                              {/* Order Number on Card */}
                                              {total === 1 && (
                                                <span 
                                                  className="ml-2 text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded cursor-copy hover:bg-gray-200 transition-colors"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(firstItem.orderNumber);
                                                    pushToast({ description: "訂單號已複製" });
                                                  }}
                                                  title="點擊複製訂單號"
                                                >
                                                  #{firstItem.orderNumber}
                                                </span>
                                              )}
                                         </h3>
                                         {urgencyLabel && (
                                            <div className="mt-0.5">
                                                {urgencyLabel}
                                            </div>
                                         )}
                                     </div>
                                     <div className="flex-shrink-0">
                                        {workflowBadge}
                                     </div>
                                 </div>
                                 
                                 <div className="flex items-center mt-1 gap-1.5">
                                     <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${processingCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                        {processingCount > 0 ? `${processingCount} 待處理` : '全完成'}
                                     </span>
                                     <span className="text-gray-400 text-xs">/ 共{total}筆訂單</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}
            
             <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-4 mt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  {page} / {Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
             
            </div>
          </CardContent>
        </Card>
        <OrderModal
          open={modalOpen}
          onOpenChange={(o) => {
            setModalOpen(o)
            if (!o) collapseAll()
          }}
          sku={selectedSku ?? ''}
          initialItems={groups.find((g) => g.sku === selectedSku)?.items ?? []}
          product={findProductForSku(selectedSku ?? '')}
          onAction={sendWhatsapp}
          formatTime={formatTime}
        />

        {/* Fullscreen Image Overlay */}
        {fullscreenImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setFullscreenImage(null)}
          >
            <div className="relative max-w-full max-h-full w-full h-full flex flex-col items-center justify-center">
               <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 z-10 rounded-full w-12 h-12"
                onClick={() => setFullscreenImage(null)}
              >
                <XIcon className="w-8 h-8" />
              </Button>
              <div className="relative w-full h-full max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <Image 
                  src={fullscreenImage} 
                  alt="Full preview" 
                  fill 
                  className="object-contain" 
                  priority
                />
              </div>
            </div>
          </div>
        )}

        <audio ref={audioRef} src={NOTIFICATION_SOUND} preload="auto" onError={(e) => console.error("Audio Load Error:", e.currentTarget.error)} />

        <AlertDialog open={showAudioConsent} onOpenChange={setShowAudioConsent}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>啟用即時通知音效 (Enable Audio)</AlertDialogTitle>
              <AlertDialogDescription>
                系統需要您的許可才能在收到新訂單時播放提示音。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAudioEnabled(false)}>保持靜音</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.play().then(() => {
                        audioRef.current?.pause();
                        audioRef.current!.currentTime = 0;
                    }).catch(console.error);
                  }
                  setAudioEnabled(true);
                  setShowAudioConsent(false);
                }}
              >
                開啟音效 (Enable)
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
