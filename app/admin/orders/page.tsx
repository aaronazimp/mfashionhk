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
          SKU_details (
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

  // Small component to display live time-left until cutoff (cutoff = latest + 1 hour)
  function TimeLeft({ target }: { target: Date }) {
    const format = (t: number) => {
        const diff = Math.max(0, t - Date.now())
        if (diff <= 0) return '已截止'
        const d = Math.floor(diff / (1000 * 60 * 60 * 24))
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const s = Math.floor((diff % (1000 * 60)) / 1000)
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `剩餘: ${d}日${pad(h)}時${pad(m)}分${pad(s)}秒`
    }

    const [label, setLabel] = useState(() => format(target.getTime()))

    useEffect(() => {
      const tick = () => setLabel(format(target.getTime()))
      tick()
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }, [target])

    return <span className="font-bold text-green-700">{label}</span>
  }

  // WhatsApp helpers
  const buildWhatsappUrl = (phone: string, text: string) => {
    const pn = (phone || "").replace(/\D/g, "");
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${pn}?text=${encoded}`;
  };

  // Find product by matching digit-only SKU portions (orders use a different SKU format)
  const findProductForSku = (orderSku: string) => {
    const digits = (orderSku || "").replace(/\D/g, "");
    return products.find((p) => (p.sku || "").replace(/\D/g, "") === digits);
  };

  const sendWhatsapp = (r: Registration, type: string, options?: { skipRedirect?: boolean }) => {
    const name = r.customerName ?? "顧客";
    const sku = r.sku ?? "";
    const variation = r.variation ?? "";
    let text = "";

    if (type === "confirm") {
      text = `您好 ${name}，您的訂單 ${sku} (${variation}) 已確認。請於24小時內完成付款。若需付款資料或支付連結，請回覆本訊息。謝謝！`;
    } else if (type === "out-of-stock") {
      text = `您好 ${name}，很抱歉，您預約的商品 ${sku} (${variation}) 目前缺貨。如需退款或等待補貨，請告訴我們。造成不便敬請見諒。`;
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

    // optimistic update: mark the single order as processed so user sees it's handled
    const updater = (prev: Registration[]) => prev.map((item) => {
        if (item.id !== r.id) return item;

        let s = item.status;
        if (type === 'confirm') s = 'in-stock';
        else if (type === 'out-of-stock') s = 'out-of-stock';
        else if (type === 'verify') s = 'verified';
        else if (type === 'void') s = 'void';
        else if (type === 'archive') s = 'completed';
        else if (type === 'undo') s = 'pending'; // Reset to pending on undo

        return { ...item, status: s, adminAction: type as any };
    });

    setRegistrations(updater);

    pushToast({
      title: "已處理",
      description: `${name} 的訂單操作: ${type}`,
      open: true,
    });
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
                SKU_details (
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
                  <Input placeholder="搜尋 SKU（可部分匹配）" value={searchSku} onChange={(e) => setSearchSku((e.target as HTMLInputElement).value)} className="text-sm" />
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
                  const skuDate = firstItem.skuDate;
                  const deadline = firstItem.reelsDeadline;

                  // Deadline Logic
                  const isCutoff = deadline && new Date(deadline) < new Date();
                  const isActive = deadline && new Date(deadline) > new Date();

                  let deadlineBadge = null;
                  if (isActive) {
                    deadlineBadge = (
                      <span className="inline-flex items-center text-[10px] font-medium text-green-700">
                         <TimeLeft target={new Date(deadline!)} />
                      </span>
                    );
                  }
                  
                  // 1. Calculate Stats
                  const total = g.items.length;
                  const unpaid = g.items.filter(i => ['confirmed', 'in-stock', 'pending'].includes(i.status)).length;
                  const verifying = g.items.filter(i => i.status === 'paid').length;
                  const completed = g.items.filter(i => ['verified', 'completed'].includes(i.status)).length;
                  const voided = g.items.filter(i => ['void', 'out-of-stock'].includes(i.status)).length;
                  const waitlist = g.items.filter(i => i.status === 'waitlist').length;

                  // 2. Stats for Progress Bar (Color Stops)
                  const pCompleted = (completed / total) * 100;
                  const pVerifying = (verifying / total) * 100;
                  const pUnpaid = (unpaid / total) * 100;
                  const pVoid = (voided / total) * 100;
                  const pWaitlist = (waitlist / total) * 100;

                  // 3. CTA Logic
                  let cta = null;
                   const isAllCompleted = g.items.every(i => 
                    ['verified', 'completed', 'void', 'out-of-stock'].includes(i.status)
                  );

                  if (!isAllCompleted) {
                    cta = (
                      <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200 whitespace-nowrap">
                        待處理
                      </div>
                    );
                  } else {
                    cta = (
                      <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200 whitespace-nowrap">
                        已完成
                      </div>
                    );
                  }

                   // 4. Variation Logic
                  const variationStats = g.items.reduce((acc, it) => {
                    if (!acc[it.variation]) {
                      acc[it.variation] = { count: 0, hasVerifying: false };
                    }
                    acc[it.variation].count += 1;
                    if (it.status === 'paid') {
                      acc[it.variation].hasVerifying = true;
                    }
                    return acc;
                  }, {} as Record<string, { count: number, hasVerifying: boolean }>);


                  return (
                    <div 
                      key={g.sku} 
                      className="group relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden pb-4"
                      onClick={() => toggleExpand(g.sku)}
                    >
                      {/* Top Row */}
                      <div className="p-4 flex gap-4">
                        {/* Image */}
                        <div 
                          className="w-20 rounded-lg bg-gray-100 flex-shrink-0 relative overflow-hidden border border-gray-100 cursor-zoom-in"
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
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                  {firstItem.skuId ? (
                                    <Link 
                                      href={`/product/${firstItem.skuId}`} 
                                      target="_blank"
                                      onClick={(e) => e.stopPropagation()} 
                                      className="hover:text-blue-600 hover:underline decoration-blue-300 underline-offset-4 transition-all"
                                    >
                                      {g.sku}
                                    </Link>
                                  ) : (
                                    g.sku
                                  )}
                                </h3>
                                <div className="text-xs text-gray-500 mt-0.5">{skuDate || '無日期'}</div>
                            </div>

                              {(deadlineBadge || isActive || isCutoff) && (
                                <div className="mt-1 flex items-center justify-between w-full">
                                  {(isActive || isCutoff) && (
                                     <span className={`text-[10px] font-medium flex items-center gap-1 ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                        {isActive ? '收單中' : '已截單'}
                                     </span>
                                  )}
                                  {deadlineBadge}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between mt-1">
                                <span className="font-medium text-gray-700 text-sm">合共{total} 筆訂單</span>
                                {cta}
                              </div>
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
