"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
// Using native <img> for external images in cart previews
import { supabase } from "@/lib/supabase";
import { getCartAndUpsellItems, submitCartToReelsOrder } from "@/lib/orderService";
import type { CartRpcItem, UpsellRpcItem, CustomerProfileRpc } from '@/lib/products';
import * as Lucide from "lucide-react";
import { Spinner } from '@/components/ui/spinner'
import LoadingOverlay from '@/components/ui/loading-overlay'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
} from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import ProductDrawer from '@/components/ProductDrawer';

// Using RPC types from lib/products.ts

export function GlobalCart() {
    const router = useRouter();
    const carouselOptions: any = React.useMemo(() => ({ align: 'start', containScroll: 'trimSnaps', loop: false }), []);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
    const [cartItems, setCartItems] = useState<CartRpcItem[]>([]);
  const [loading, setLoading] = useState(false);
    const [customerInfo, setCustomerInfo] = useState({ name: "", whatsapp: "", address: "" });
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    // Upsell state
    const [upsellItems, setUpsellItems] = useState<UpsellRpcItem[]>([]);
    const [addingUpsellId, setAddingUpsellId] = useState<number | string | null>(null);
    // Product drawer state for upsell preview
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerId, setDrawerId] = useState<string | null>(null);

  
    // (removed floating button visibility state)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [itemTimers, setItemTimers] = useState<Record<string, string>>({});
    const timerRef = useRef<number | null>(null);
    const expiredReportedRef = useRef<Set<string>>(new Set());

  const { toast } = useToast();

    // Remove localStorage for customer info (now persisted in DB)

    // Initialize Session
    useEffect(() => {
        let token = localStorage.getItem("flash_sale_session_token");
        if (!token) {
                // We don't generate token here, we wait for page logic or generate if really needed? 
                // Ideally should be consistent with page.tsx 
                // For read-only cart, if no token, cart is empty.
        } else {
                setSessionToken(token);
        }

        const handleCartUpdate = () => {
                // Refresh session just in case it was created
                const currentToken = localStorage.getItem("flash_sale_session_token");
                if (currentToken) setSessionToken(currentToken);
                setRefreshTrigger(prev => prev + 1);
                // Reset submitted state when cart is updated
                setIsSubmitted(false);
        };

        window.addEventListener("cart-updated", handleCartUpdate);
        return () => window.removeEventListener("cart-updated", handleCartUpdate);
    }, []);

    // Per-item reservation countdown timers
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (!isOpen || cartItems.length === 0) {
            setItemTimers({});
            return;
        }

            // If no items have expires_at, nothing to do
            const itemsWithExpiry = cartItems.filter((it: any) => it.expires_at);
            // Reset reported-expired set whenever the watched items list changes
            expiredReportedRef.current.clear();
        if (itemsWithExpiry.length === 0) {
            setItemTimers({});
            return;
        }

        const tick = () => {
            const now = Date.now();
            const newTimers: Record<string, string> = {};
            let anyExpired = false;

            itemsWithExpiry.forEach((it: any) => {
                const id = String((it as any).cart_item_id ?? (it as any).id ?? '');
                const exp = it.expires_at ? new Date(it.expires_at).getTime() : NaN;
                if (!Number.isFinite(exp)) {
                    newTimers[id] = "";
                    return;
                }
                const diff = exp - now;
                                if (diff <= 0) {
                                        newTimers[id] = "0000";
                                        // Only treat as an "expiration event" the first time it becomes expired
                                        if (!expiredReportedRef.current.has(id)) {
                                            anyExpired = true;
                                            expiredReportedRef.current.add(id);
                                        }
                                } else {
                    const mm = Math.floor(diff / 60000);
                    const ss = Math.floor((diff % 60000) / 1000);
                    const mmStr = String(mm).padStart(2, "0");
                    const ssStr = String(ss).padStart(2, "0");
                    newTimers[id] = `${mmStr}${ssStr}`;
                }
            });

            setItemTimers(newTimers);

            if (anyExpired) {
                // Refresh cart to reflect expirations
                setRefreshTrigger((p) => p + 1);
            }
        };

        tick();
        timerRef.current = window.setInterval(tick, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isOpen, cartItems]);

    // Allow other parts of the app to open the cart programmatically
    useEffect(() => {
        const openHandler = () => setIsOpen(true);
        const openCheckoutHandler = () => {
            setIsOpen(true);
            // give the sheet time to open then focus the checkout name input
            setTimeout(() => {
                const el = document.getElementById('checkout-name') as HTMLInputElement | null;
                if (el) el.focus();
            }, 400);
        };

        window.addEventListener('open-cart', openHandler);
        window.addEventListener('open-cart-checkout', openCheckoutHandler);
        return () => {
            window.removeEventListener('open-cart', openHandler);
            window.removeEventListener('open-cart-checkout', openCheckoutHandler);
        };
    }, []);

    // Fetch Cart and Upsell Items using RPC
    useEffect(() => {
        if (!sessionToken) return;
        setLoading(true);
        (async () => {
            try {
                const data = await getCartAndUpsellItems(sessionToken);
                if (!data) {
                    setCartItems([]);
                    setUpsellItems([]);
                    return;
                }
                // Use RPC items directly
                const cartItemsRaw: CartRpcItem[] = data.cart_items || [];
                setCartItems(cartItemsRaw);
                // Notify other UI (immersive feed) about cart count
                try { window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: (cartItemsRaw || []).length } })); } catch {}

                const upsells: UpsellRpcItem[] = data.upsell_items || [];
                // Sort upsells by ID to ensure stable order across refetches
                const sortedUpsells = [...upsells].sort((a, b) => String(a.id).localeCompare(String(b.id)));
                setUpsellItems(sortedUpsells);

                // Prefer explicit customer_profile from RPC if available
                const cp: CustomerProfileRpc | undefined = data.customer_profile ?? undefined;
                if (cp && (cp.name || cp.whatsapp || cp.address)) {
                    setCustomerInfo({ name: cp.name || '', whatsapp: cp.whatsapp || '', address: cp.address || '' });
                }
            } catch (err) {
                console.error('Cart fetch error:', err);
                setCartItems([]);
                setUpsellItems([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionToken, refreshTrigger, isOpen]);
    // Add upsell item to cart (server-side insertion removed)
    // Keep UI: open the product drawer for the upsell so user can preview/confirm
    const handleAddUpsell = async (upsell: UpsellRpcItem) => {
        setDrawerId(String(upsell.id));
        setDrawerOpen(true);
    };

    const totalAmount = cartItems.reduce((sum, item) => sum + ((Number(item.regular_price) || 0) * (Number(item.quantity) || 0)), 0);

    // Customer info is handled by RPC on submit; keep local state only

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerInfo.name || !customerInfo.whatsapp || !customerInfo.address) {
                toast({ title: "請填寫資料", description: "請輸入稱呼、WhatsApp 及地址", variant: "destructive" });
                return;
        }

        // Normalize and validate WhatsApp as exactly 8 digits
        const whatsappClean = String(customerInfo.whatsapp || '').replace(/\D/g, '');
        if (!/^\d{8}$/.test(whatsappClean)) {
                    toast({ title: "請輸入正確嘅 WhatsApp 號碼", description: "請輸入 8 位數字嘅 WhatsApp 號碼", variant: "destructive" });
                    return;
            }

        // Persist cleaned whatsapp in state so submission uses normalized value
        if (whatsappClean !== customerInfo.whatsapp) {
                setCustomerInfo(prev => ({ ...prev, whatsapp: whatsappClean }));
        }

        setIsCheckingOut(true);
    try {
        // Session customer info is handled by the `submit_cart_to_reels_order` RPC in orderService.
        const data = await submitCartToReelsOrder(
            sessionToken || null,
            customerInfo.name,
            customerInfo.whatsapp,
            customerInfo.address
        );

        // If reserved_count > 0, redirect to payment page
        const reservedCount = (data as any)?.reserved_count ?? 0;
        if (reservedCount > 0) {
            // Prefer redirecting to transaction-based payment when backend hints so
            const redirectHint = (data as any)?.redirect_hint || null;
            const transactionId = (data as any)?.transaction_id || null;
            const orderNumber = (data as any)?.order_number || (data as any)?.orderNumber || null;
            const orderId = (data as any)?.order_id || (data as any)?.id || (data as any)?.order || null;

            setIsSubmitted(true);
            setCartItems([]);
            setIsOpen(false);

            if (redirectHint === 'payment' && transactionId) {
                // Redirect to payment using transaction id when requested by RPC
                router.push(`/pay/${encodeURIComponent(String(transactionId))}`);
            } else if (orderNumber) {
                router.push(`/pay/${encodeURIComponent(String(orderNumber))}`);
            } else if (orderId) {
                router.push(`/pay/${orderId}`);
            } else {
                router.push(`/pay`);
            }
            return;
        }

        setIsSubmitted(true);
        setCartItems([]);
        try { window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: 0 } })); } catch {}
        // Refresh token logic? Usually session persists but items are gone.
    } catch (err: any) {
        toast({ title: "錯誤", description: err.message || "結帳失敗", variant: "destructive" });
    } finally {
        setIsCheckingOut(false);
    }
  };

    const removeItem = async (itemId: string | number) => {
            // Optimistic update
            setCartItems(prev => prev.filter(i => ((i as any).cart_item_id ?? (i as any).id) !== itemId));
      
        const { error } = await supabase.from('reels_orders_cart_items').delete().eq('id', itemId);
      if (error) {
          toast({ title: "刪除失敗", variant: "destructive" });
          setRefreshTrigger(prev => prev + 1); // Revert/Reload
      } else {
          // If empty, notify UI via event (no floating button to hide)
          try { window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: Math.max(0, (cartItems.length || 0) - 1) } })); } catch {}
      }
  };

    // Component remains mounted so it can respond to `open-cart` events.

    return (
        <>
            {/* Floating cart button removed - cart opens via programmatic events or other UI */}

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="right" className="w-full sm:w-[540px] flex flex-col h-full px-4 sm:px-6 bg-white">
                    <SheetHeader>
                        <SheetTitle>
                            <span className="flex text-center gap-2 text-sm">
                                購物車
                            </span>
                        </SheetTitle>
                        <SheetDescription className="text-xs text-center">
                            {isSubmitted ? "訂單已提交" : "請填寫聯絡資料以完成訂單"}
                        </SheetDescription>
                      
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto pt-2 pb-6 px-2 sm:px-0 space-y-6">
                        {isSubmitted ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-3">
                                <Lucide.CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                                <h4 className="text-xl font-bold text-green-700">登記成功！</h4>
                                <p className="text-green-600">我們的客服將會盡快透過 WhatsApp 聯繫您確認訂單。</p>
                                <Button className="mt-4 bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" onClick={() => setIsOpen(false)}>
                                    關閉
                                </Button>
                            </div>
                        ) : (
                            <>
                                {loading && cartItems.length === 0 ? (
                                    <div className="flex justify-center p-8"><Spinner className="h-8 w-8 text-gray-900" /></div>
                                ) : cartItems.length === 0 ? (
                                    <div className="text-center text-zinc-500 py-10">購物車是空的</div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Upsell Section */}
                                        {upsellItems.length > 0 && (
                                            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl relative">
                                                <div className="flex items-center gap-2 font-bold text-sm mb-2 text-yellow-800">
                                              
                                                    加購優惠
                                                </div>
                                                <div className="mb-3 text-xs font-semibold text-yellow-700 text-center flex items-center gap-2 justify-center">
                                                     <Lucide.Gift className="w-4 h-4 text-yellow-600" />
                                                    買多1件全單減$5，買多2件減$10! 優惠無上限!!
                                                </div>
                                                <Carousel opts={carouselOptions} className="relative">
                                                    <CarouselContent className="-ml-6">
                                                        {upsellItems.map((upsell) => (
                                                            <CarouselItem
                                                                key={upsell.id}
                                                                className="ml-2 flex gap-4 justify-center shrink-0 w-[200px] min-w-[160px] max-w-[50%]"
                                                            >
                                                                    <div
                                                                        className="bg-white rounded-lg border border-yellow-100 shadow-sm p-3 min-w-[160px] flex flex-col items-center cursor-pointer hover:shadow-md transition"
                                                                        onClick={(e) => {
                                                                            // Prevent opening when clicking the button
                                                                            if ((e.target as HTMLElement).closest('button')) return;
                                                                            setDrawerId(String(upsell.id));
                                                                            setDrawerOpen(true);
                                                                        }}
                                                                    >
                                                                    <div className="w-20 h-20 rounded-md overflow-hidden bg-zinc-100 mb-2 flex items-start justify-center">
                                                                        {upsell.main_image ? (
                                                                            <img
                                                                                src={upsell.main_image}
                                                                                alt={upsell.SKU}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                                                                            />
                                                                        ) : (
                                                                            <div className="w-full h-full bg-zinc-200" />
                                                                        )}
                                                                    </div>
                                                                    <div className="w-full flex flex-col items-center">
                                                                        <div className="font-bold text-xs mb-1 text-yellow-900 text-center w-full">{upsell.SKU}</div>
                                                                        <div className="text-yellow-700 font-bold mb-2 text-center w-full text-xs">HKD ${upsell.regular_price}</div>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 w-full mt-1 text-center text-xs"
                                                                        disabled={addingUpsellId === upsell.id}
                                                                        onPointerDown={(e) => e.stopPropagation()}
                                                                        onTouchStart={(e) => e.stopPropagation()}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleAddUpsell(upsell);
                                                                        }}
                                                                    >
                                                                        {addingUpsellId === upsell.id ? '加入中...' : '加入購物車'}
                                                                    </Button>
                                                                </div>
                                                            </CarouselItem>
                                                        ))}
                                                    </CarouselContent>
                                                    <CarouselPrevious className="-left-4 top-1/2 -translate-y-1/2" />
                                                    <CarouselNext className="-right-4 top-1/2 -translate-y-1/2" />
                                                </Carousel>
                                            </div>
                                        )}
                                        {/* ...existing code... */}
                                        {cartItems.map((item) => (
                                            <div key={(item as any).cart_item_id ?? (item as any).id} className="bg-white p-4 rounded-lg flex items-stretch gap-4 relative group border border-zinc-100 shadow-sm hover:shadow-md">
                                                <div className="w-24 h-full rounded-md overflow-hidden bg-white shrink-0 flex-shrink-0">
                                                    {((item as any).main_image) ? (
                                                        <img
                                                            src={(item as any).main_image}
                                                            alt={(item as any).SKU}
                                                            className="w-full h-full object-cover object-top"
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-200" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-xs">{(item as any).SKU}</div>
                                                            {(() => {
                                                                const text = (item as any).status === 'reserved'
                                                                    ? '現貨'
                                                                    : (item as any).status === 'waitlist'
                                                                        ? '預訂'
                                                                        : (item as any).status;
                                                                return (
                                                                    <div className={
                                                                        (item as any).status === 'reserved'
                                                                            ? 'text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700'
                                                                            : 'text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800'
                                                                    }>{text}</div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <button
                                                            onClick={() => removeItem((item as any).cart_item_id ?? (item as any).id)}
                                                            className="text-zinc-400 hover:text-red-500 p-1"
                                                        >
                                                            <Lucide.X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-zinc-500 mt-1">{(item as any).color} / {(item as any).size}</div>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="text-xs text-[color:var(--color-primary)]">HKD ${(item as any).regular_price}</div>
                                                        <div className="text-xs text-zinc-500">x {(item as any).quantity}</div>
                                                    </div>

                                                    {(item as any).expires_at && (
                                                        <div className="mt-2 inline-flex flex-col items-start gap-1">
                                                            <div className="text-xs text-red-500">庫存保留倒數</div>
                                                            <div className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-mono text-xs animate-pulse">
                                                                {(() => {
                                                                    const raw = itemTimers[String((item as any).cart_item_id ?? (item as any).id)];
                                                                    if (!raw) return "--:--";
                                                                    if (raw.length >= 4) return `${raw.slice(0, 2)}:${raw.slice(2)}`;
                                                                    return raw;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="border-t pt-4 flex justify-between items-center font-bold text-md">
                                            <span>總金額</span>
                                            <span className="text-[color:var(--color-primary)]">HKD ${totalAmount}</span>
                                        </div>
                                    </div>
                                )}

                                {cartItems.length > 0 && (
                                    <form id="checkout-form" onSubmit={handleCheckout} noValidate className="space-y-4 mt-8 border-t pt-6 text-[9px]">
                                        <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
                                            
                                            聯絡資料
                                        </h3>
                                        <div className="space-y-2">
                                            <Label htmlFor="checkout-name" className="!text-xs flex items-center gap-1">
                                                 <Lucide.User className="w-4 h-4 text-blue-400" />
                                                稱呼
                                            </Label>
                                            <Input
                                                className="!text-xs"
                                                id="checkout-name"
                                                placeholder="請輸入您的稱呼"
                                                value={customerInfo.name}
                                                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="checkout-whatsapp" className="!text-xs flex items-center gap-1">
                                                 <Lucide.Phone className="w-4 h-4 text-green-500" />
                                                WhatsApp號碼
                                            </Label>
                                            <Input
                                                className="!text-xs"
                                                id="checkout-whatsapp"
                                                type="tel"
                                                inputMode="numeric"
                                                maxLength={8}
                                                pattern="\\d{8}"
                                                placeholder="6123 4567"
                                                value={customerInfo.whatsapp}
                                                onChange={(e) => setCustomerInfo(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '').slice(0,8) }))}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="checkout-address" className="!text-xs flex items-center gap-1">
                                                 <Lucide.MapPin className="w-4 h-4 text-zinc-700" />
                                                地址
                                            </Label>
                                            <Input
                                                className="!text-xs"
                                                id="checkout-address"
                                                placeholder="收件地址 / 送貨地址"
                                                value={customerInfo.address}
                                                onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                                                required
                                            />
                                        </div>

                                        <Button type="submit" className="w-full bg-[color:var(--color-primary)] hover:brightness-95 text-[color:var(--color-primary-foreground)] font-bold h-12 mt-4" disabled={isCheckingOut}>
                                            {isCheckingOut ? (
                                                <div className="flex items-center gap-2">
                                                    <Spinner className="h-4 w-4 text-white" />
                                                    處理中...
                                                </div>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                     <Lucide.CheckCircle2 className="w-5 h-5 text-white" />
                                                    確認下單
                                                </span>
                                            )}
                                        </Button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </SheetContent>
                {/* Product drawer for upsell preview */}
                <ProductDrawer id={drawerId} open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setDrawerId(null); }} />
                {isCheckingOut && <LoadingOverlay message="正在提交訂單…" />}
            </Sheet>
        </>
  );
}

export default GlobalCart;
