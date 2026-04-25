
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { getPaymentPageData } from "../../../lib/orderService";
import type { PaymentPageOrder, PaymentPageItem } from "../../../lib/products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import * as Lucide from "lucide-react";
import { PaymentUploadForm } from "@/components/payment-upload-form";
import { CountdownTimer } from "@/components/countdown-timer";
import Link from "next/link";
import OrderCardReadOnly from '@/components/OrderCardReadOnly';
import { useRouter } from 'next/navigation';

// Custom timer for HH:MM:SS (hours:minutes:seconds)
function CustomCountdownTimer({ targetDate, onEnd }: { targetDate: Date, onEnd?: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        if (!ended) {
          setEnded(true);
          onEnd && onEnd();
        }
      }
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);
  const formatNumber = (num: number) => num.toString().padStart(2, "0");
  return (
    <span className="font-mono font-bold tracking-widest tabular-nums text-red-500">
      {formatNumber(timeLeft.hours)}時{formatNumber(timeLeft.minutes)}分{formatNumber(timeLeft.seconds)}秒
    </span>
  );
}

// Simple client-side Error Boundary to display render errors during development
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props as any);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("PaymentClient render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen p-6 bg-red-50 flex items-start justify-center">
          <div className="max-w-3xl w-full bg-white border border-red-200 rounded p-4">
            <h3 className="text-lg font-semibold text-red-700">Client render error</h3>
            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}</pre>
            {/* Transaction ID footer */}
          </div>
          
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

// Use shared PaymentPageOrder from lib/products


export default function PaymentClient({ order }: { order: PaymentPageOrder }) {
  // Helper to fetch latest order and update state
  const fetchOrder = async (id: string, setLiveOrder: React.Dispatch<React.SetStateAction<PaymentPageOrder>>) => {
    try {
      const data = await getPaymentPageData(id);
      if (!data) return;
      let payload: any = data;
      if (Array.isArray(payload)) {
        payload = payload[0] ?? payload;
      }
      if (!payload) return;

      // If RPC returns a wrapper object like { get_payment_page_data: { orders: {...}, ... } }
      const core = payload.get_payment_page_data ?? payload;

      const normalized: any = {};
      // If returned as order-centric 'orders' map, use it as pay_now_groups
      if (core.orders && typeof core.orders === 'object') {
        normalized.pay_now_groups = core.orders;
        // derive waitlist / cancelled lists for compatibility
        const allItems: any[] = Object.values(core.orders).flat();
        normalized.items_waitlist = allItems.filter((it: any) => it.status === 'waitlist');
        normalized.items_cancelled = allItems.filter((it: any) => it.status === 'cancelled');
      }

      // Copy other top-level metadata if present
      const fieldsToCopy = ['status', 'subtotal', 'whatsapp', 'shipping_fee', 'total_to_pay', 'transaction_id', 'payment_deadline', 'payment_proof_url'];
      fieldsToCopy.forEach((f) => {
        if (core[f] !== undefined) normalized[f] = core[f];
      });

      // Fallback: if payload contains items directly, merge them too
      if (!normalized.pay_now_groups && payload.pay_now_groups) normalized.pay_now_groups = payload.pay_now_groups;

      setLiveOrder((prev: PaymentPageOrder) => ({ ...prev, ...normalized }));
      return normalized;
    } catch {}
  };
  // State for live order status
  const [liveOrder, setLiveOrder] = useState<PaymentPageOrder>(order);
  const router = useRouter();


  // Subscribe to Supabase Realtime for instant updates
  useEffect(() => {
    // Listen to changes on the reels_orders table for this order
    // Filter realtime events to this transaction so we only react to relevant changes.
    const txId = String(order.transaction_id ?? order.id ?? '');
    const channel = supabase.channel(`reels-order-status-${txId}`);
    // Subscribe scoped to this transaction to avoid relying on server-side
    // status filters (which may be sensitive to quoting or casing).
    // Use event '*' so we catch any change that may affect status.
    (channel as any).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reels_orders',
        // Filter by transaction_id on the DB row so we only receive events
        // for the specific order we're viewing.
        filter: `transaction_id=eq.${txId}`,
      },
      async (payload: any) => {
        try {
          console.log('[Supabase Realtime] reels_orders payload (tx-scoped):', payload);
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          // If payload contains no `new` row (e.g., a delete), ignore
          if (!newRow) return;
          // Only act when status actually changed (or when we don't have oldRow)
          if (oldRow && oldRow.status === newRow.status) return;
          // Refresh the order state from the server
          await fetchOrder(order.id, setLiveOrder);
        } catch (e) {
          console.error('Realtime status handler error:', e);
        }
      }
    );

    // subscribe and log potential subscription errors
    (async () => {
      try {
        const res = await (channel as any).subscribe();
        if ((res as any)?.error) console.error('realtime subscribe error', (res as any).error);
        else console.debug('realtime subscribed for tx', txId);
      } catch (err) {
        console.error('realtime subscribe threw', err);
      }
    })();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Fetch latest order once on mount to ensure we have pay_now_groups, cancelled, and waitlist data
  useEffect(() => {
    fetchOrder(order.id, setLiveOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Log order.deadline for debugging
  useEffect(() => {
    const d = liveOrder.payment_deadline || liveOrder.deadline;
    if (d) {
      console.log('CountdownTimer deadline:', d);
    }
  }, [liveOrder.payment_deadline, liveOrder.deadline]);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('fps');
  

  // Use pay_now_groups as the canonical source for payable items grouped by original order number
  const payNowGroups: Record<string, PaymentPageItem[]> = (liveOrder.pay_now_groups ?? {}) as Record<string, PaymentPageItem[]>;
  const waitlistItems = liveOrder.items_waitlist ?? [];
  const cancelledItems = liveOrder.items_cancelled ?? [];

  // Treat order as cancelled if server sets top-level status OR if there are
  // no pay-now groups but we have cancelled items (RPC may only mark rows).
  const isOrderCancelled = (liveOrder.status === 'cancelled') || (
    Object.keys(payNowGroups).length === 0 && cancelledItems.length > 0
  );

  // Debug help: log counts so we can confirm data present
  // eslint-disable-next-line no-console
  console.debug('[PaymentClient] pay_now_groups keys', Object.keys(payNowGroups), 'waitlist:', waitlistItems.length, 'cancelled:', cancelledItems.length);

  // subtotal / displayTotal strictly derived from items within pay_now_groups
  const subtotal = Object.values(payNowGroups)
    .flat()
    .reduce((sum: number, it: any) => sum + (Number(it.row_total ?? (it.price * it.quantity)) || 0), 0);
  const displayTotal = subtotal;
  // Prefer server-provided total_to_pay when available (RPC result), otherwise derive from items
  const displayAmount = Number(liveOrder.total_to_pay ?? displayTotal ?? 0);

  const isPaymentSubmitted = ['paid', 'verified', 'completed'].includes(liveOrder.status ?? '') || !!liveOrder.payment_proof_url;

  // If the order is already paid (or has a payment proof), auto-advance to the confirmation step
  useEffect(() => {
    // If payment becomes submitted while the user is mid-flow (step 2 or 3), jump to confirmation.
    // Do not force users back to confirmation on initial load so they can still view items (step 1).
    if (isPaymentSubmitted && currentStep > 1 && currentStep !== 4) {
      goToStep(4);
    }
  }, [isPaymentSubmitted, currentStep]);

  // Guarded step navigation: allow viewing step 1 after payment, but block steps 2 and 3.
  const goToStep = (step: 1 | 2 | 3 | 4) => {
    if (isPaymentSubmitted && (step === 2 || step === 3)) return;
    setCurrentStep(step);
  };
  // Show an "under review" banner when status is 'paid' but not yet verified/completed
  const isUnderReview = (liveOrder.status ?? '') === 'paid' && !['verified', 'completed'].includes(liveOrder.status ?? '');

  // Simple PayMe link placeholder
  const payMeLink = `#`;

  const handlePaymentMethodSelected = () => {
    goToStep(3);
  };

  const handlePaymentProofUploaded = () => {
    goToStep(4);
  };

  const historyQuery = (() => {
    try {
      const params = new URLSearchParams();
      const tx = liveOrder.transaction_id ?? liveOrder.order_number ?? liveOrder.id ?? '';
      if (tx) params.set('transaction_id', String(tx));
      if (liveOrder.whatsapp) params.set('whatsapp', String(liveOrder.whatsapp));
      const q = params.toString();
      return q ? `?${q}` : '';
    } catch {
      return '';
    }
  })();

  return (
    <ErrorBoundary>
      <div className="min-h-[90vh] bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500 relative z-[9999]">
          <div className="p-6 md:p-8 space-y-6">
            
            {/* Check if order is cancelled */}
            {isOrderCancelled ? (
              <div className="bg-white flex items-center justify-center p-4 font-sans">
                <div className="bg-white p-8 text-center max-w-md w-full space-y-6">
                  <div className=" flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="space-y-1 mb-6">
                    <h1 className="text-md font-bold text-gray-900 mb-9">訂單已取消</h1>
                    <p className="text-sm text-gray-600">如果您有任何疑問或需要協助，</p>
                    <a
                      href="https://wa.me/85257290882"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 underline hover:text-green-700 text-sm"
                    >請聯繫我們的客戶服務。</a>
                  </div>
                  
                  <a href="/flash-sale" className="mt-9 text-xs p-2 w-full h-[30px] bg-[#A87C73] text-white rounded-lg font-semibold hover:bg-[#986B62] transition">
                    返回選購商品
                  </a>
                 
                </div>
              </div>
            ) : (
              <>
                {/* (Timer moved below items, above total) */}

                
                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 1 ? 'bg-[#A87C73] text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
                  <div className={`h-1 flex-1 ${currentStep >= 2 ? 'bg-[#A87C73]' : 'bg-gray-200'}`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 2 ? 'bg-[#A87C73] text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
                  <div className={`h-1 flex-1 ${currentStep >= 3 ? 'bg-[#A87C73]' : 'bg-gray-200'}`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 3 ? 'bg-[#A87C73] text-white' : 'bg-gray-200 text-gray-600'}`}>3</div>
                  <div className={`h-1 flex-1 ${currentStep >= 4 ? 'bg-[#A87C73]' : 'bg-gray-200'}`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 4 ? 'bg-[#A87C73] text-white' : 'bg-gray-200 text-gray-600'}`}>4</div>
                </div>

                {/* Payment Deadline Timer - show across all steps (unless submitted or cancelled) */}
                {(liveOrder.payment_deadline || liveOrder.deadline) && !isPaymentSubmitted && liveOrder.status !== 'cancelled' && (
                  <div className="mb-4 text-[10px] text-gray-700 rounded p-2 text-center">
                    付款截止時間: <CustomCountdownTimer targetDate={new Date((liveOrder.payment_deadline || liveOrder.deadline) as string)} onEnd={async () => {
                      // Try an immediate re-fetch. If server hasn't marked cancelled yet,
                      // poll briefly a few times so the UI updates without a manual refresh.
                      try {
                        const res = await fetchOrder(order.id, setLiveOrder);
                        if (res && res.status === 'cancelled') return;
                        const attempts = 6;
                        for (let i = 0; i < attempts; i++) {
                          await new Promise((r) => setTimeout(r, 1000));
                          const r2 = await fetchOrder(order.id, setLiveOrder);
                          if (r2 && r2.status === 'cancelled') break;
                        }
                      } catch (e) {
                        // ignore — we attempted to refresh state
                      }
                    }} />
                  </div>
                )}

                {/* Step 1: Item Breakdown */}
                {currentStep === 1 && (
                  <>
                    {/* transaction id moved below the amount */}

                    {/* Items Breakdown */}
                    <div className="mb-4 w-full">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-zinc-600 mb-9 text-center">以下是您訂購的產品，核對無誤後進入下一步付款</p>
                        <h4 className="text-center mb-2 text-[10px]">項目明細</h4>
                        {Object.keys(payNowGroups).length > 0 ? (
                          Object.entries(payNowGroups).map(([origOrderNumber, items]) => (
                            <div key={origOrderNumber} className="mb-3 flex justify-center">
                                <OrderCardReadOnly
                                  order={{
                                    order_number: origOrderNumber,
                                    items: (items || []).map((it: any) => ({
                                      ...it,
                                      thumbnail: it.thumbnail ?? it.image_url ?? it.sku_img_url ?? it.imageUrl ?? null,
                                    })),
                                  }}
                                  className="bg-white rounded-lg shadow-md overflow-hidden w-full max-w-md"
                                />
                              </div>
                          ))
                        ) : (
                          <div className="text-sm text-zinc-500">無明細</div>
                        )}

                      
                      </div>
                    </div>

                    

                    

                    {/* Payment Deadline Timer (moved above total) */}
                    {/* (Timer now shown across all steps) */}

                    <div className="text-center">
                      <div className="text-sm font-black text-black tracking-tight tabular-nums">應付金額 HK$ {displayAmount.toFixed(0)}</div>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={() => goToStep(2)}
                        className={`w-full bg-[#A87C73] hover:bg-[#986B62] text-white text-xs w-[99px] h-[40px] rounded-full shadow-md transition-transform active:scale-95 ${isPaymentSubmitted ? 'opacity-60 cursor-not-allowed hover:bg-[#A87C73]' : ''}`}
                        disabled={isPaymentSubmitted}
                      >
                        {isPaymentSubmitted ? '付款已提交' : '下一步：選擇付款方式'}
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2: Choose Payment Method */}
                {currentStep === 2 && (
                  <>
                    <div className="text-center">
                      <h1 className="text-xs font-semibold text-gray-600">選擇付款方式</h1>
                    </div>

                    {/* Payment Method Selection */}
                    <Tabs value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod} className="w-full">
                      <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-gray-100/50 rounded-xl">
                         <TabsTrigger value="fps" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#00ab4e]">
                          <Lucide.Banknote className="w-5 h-5" />
                          轉數快
                        </TabsTrigger>
                        <TabsTrigger value="payme" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#E53535]">
                          <Lucide.Smartphone className="w-5 h-5" />
                          PayMe
                        </TabsTrigger>
                       
                        <TabsTrigger value="wallets" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#00C250]">
                          <Lucide.QrCode className="w-5 h-5" />
                          電子錢包
                        </TabsTrigger>
                        <TabsTrigger value="card" className="flex flex-col gap-1 py-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          <Lucide.CreditCard className="w-5 h-5" />
                          信用卡
                        </TabsTrigger>
                      </TabsList>

                      <div className="mt-6 min-h-[180px]">
                        <TabsContent value="payme" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-center space-y-3">
                            <p className="text-xs text-gray-600">即將推出</p>
                            <div className="block w-full">
                              <button
                                disabled
                                title="暫時停用"
                                className="w-full bg-[#E53535] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" /></svg>
                                PayMe HKD ${displayAmount.toFixed(0)}
                              </button>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="fps" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <Card className="bg-emerald-50/50 border-emerald-100 border-dashed">
                            <CardContent className="p-4 space-y-3 text-xs text-gray-600">
                               <div className="flex justify-between items-center">
                                <span>帳戶名稱</span>
                                <span className="font-bold text-black">MFashion</span>
                              </div>
                              
                              <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                                <span>轉數快電話號碼</span>
                                <span className=" font-bold text-black selection:bg-emerald-200">+852 9165 0585</span>
                              </div>
                              
                              <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                                <span>轉帳金額</span>
                                <span className="font-bold text-black text-lg">HKD ${displayAmount.toFixed(0)}</span>
                              </div>
                             
                            </CardContent>
                          </Card>
                        </TabsContent>

                        {/* WeChat / Alipay Option */}
                        <TabsContent value="wallets" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="space-y-3">
                            <div className="block w-full">
                              <div
                                title="即將推出"
                                className="text-xs w-full bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-xl border border-gray-200 flex items-center justify-center"
                              >
                                即將推出
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        {/* Credit Card Option */}
                        <TabsContent value="card" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-center space-y-4">
                             <Lucide.CreditCard className="w-12 h-12 mx-auto text-gray-300" />
                            <div className="space-y-2">
                              <h3 className="font-medium text-gray-900">信用卡支付</h3>
                              <p className="text-sm text-gray-500">我們接受 Visa 和 MasterCard。</p>
                            </div>
                              <button className="text-xs w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors opacity-50 cursor-not-allowed">
                              支付 HKD {displayAmount.toFixed(0)} (即將推出)
                            </button>
                          </div>
                        </TabsContent>
                      </div>
                    </Tabs>

                    <div className="mt-4 space-y-3 flex flex-col items-center justify-center">
                      
                       
                      <button
                        onClick={() => goToStep(3)}
                        className={`text-xs w-full bg-[#A87C73] text-white h-[40px] rounded-xl shadow-md transition-transform active:scale-95 ${isPaymentSubmitted ? 'opacity-60 cursor-not-allowed hover:bg-[#A87C73]' : ''}`}
                        disabled={isPaymentSubmitted}
                      >
                        {isPaymentSubmitted ? '付款已提交' : '下一步：上傳入數證明'}
                      </button>
<button
                        onClick={() => goToStep(1)}
                        className="text-gray-500 text-xs w-full h-[40px] border border-gray-300 rounded-xl shadow-md transition-transform active:scale-95"
                      >
                        返回上一步
                      </button>
                     
                    </div>
                  </>
                )}

                {/* Step 3: Upload Payment Proof */}
                {currentStep === 3 && (
                  <>
                    <div className="text-center">
                      <h1 className="text-sm font-bold text-black">上傳付款證明</h1>
                      <p className="mt-1 text-[10px] text-gray-500">請上傳您的付款截圖或收據</p>
                    </div>

                    <PaymentUploadForm orderId={order.id} paymentMethod={selectedPaymentMethod} onSuccess={() => goToStep(4)} />

                    <button
                        onClick={() => goToStep(2)}
                      className="text-xs w-full h-[40px] text-gray-500  py-3 px-4 rounded-xl shadow-md transition-transform active:scale-95"
                    >
                      返回上一步
                    </button>
                  </>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 4 && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-center">
                      <Lucide.CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-green-900">已提交付款證明</h3>
                      <p className="text-xs text-green-700">我們已收到您的付款證明，感謝您的購買。</p>
                      {order.payment_proof_url && (
                        <div className="mt-4">
                          <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 underline hover:text-green-800">
                            查看已上傳的證明
                          </a>
                        </div>
                      )}
                    </div>
                    <Link href="/flash-sale" className="block">
                      <button
                        className="text-xs w-full h-[40px] bg-[#A87C73] hover:bg-[#986B62] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-transform active:scale-95 mt-4"
                      >
                        返回選購商品
                      </button>
                    </Link>
                    <Link href={`/order-history${historyQuery}`} className="block">
                      <button
                        className="text-xs w-full h-[40px] mt-3 border border-gray-300 text-gray-700 bg-white rounded-xl shadow-sm font-medium py-3 px-4 transition-transform active:scale-95"
                      >
                        查看訂單紀錄
                      </button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          

          <div className="px-6 pb-6">
            <p className="text-[10px] text-gray-400 text-center">交易編號: {liveOrder.transaction_id || liveOrder.order_number || (liveOrder.id ? liveOrder.id.slice(0, 8) : '')}</p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}