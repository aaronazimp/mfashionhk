"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
// Using native <img> for external images in cart previews
import { supabase } from "@/lib/supabase";
import { ShoppingCart, CheckCircle, Trash2, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: number;
  quantity: number;
  variation: {
    color: string;
    size: string;
  };
  product: {
    sku: string;
    price: number;
    image: string;
  };
        expires_at?: string | null;
        status?: string;
}

export function GlobalCart() {
    const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: "", whatsapp: "" });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
    // New state to control button visibility (default to visible so button appears site-wide)
    const [isVisible, setIsVisible] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [itemTimers, setItemTimers] = useState<Record<string, string>>({});
    const timerRef = useRef<number | null>(null);

  const { toast } = useToast();

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
        if (itemsWithExpiry.length === 0) {
            setItemTimers({});
            return;
        }

        const tick = () => {
            const now = Date.now();
            const newTimers: Record<string, string> = {};
            let anyExpired = false;

            itemsWithExpiry.forEach((it: any) => {
                const id = String(it.id);
                const exp = it.expires_at ? new Date(it.expires_at).getTime() : NaN;
                if (!Number.isFinite(exp)) {
                    newTimers[id] = "";
                    return;
                }
                const diff = exp - now;
                if (diff <= 0) {
                    newTimers[id] = "0000";
                    anyExpired = true;
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

  // Fetch Cart
  useEffect(() => {
    if (!sessionToken) return;

    async function fetchCart() {
      setLoading(true);
      try {
        // 1. Get Session ID
        const { data: session } = await supabase
            .from("reels_orders_cart_sessions")
            .select("id")
            .eq("session_token", sessionToken)
            .maybeSingle();

        if (!session) {
            console.log("No cart session found");
            setCartItems([]);
            setIsVisible(false);
            return;
        }

        // 2. Get Items with details
        const { data: items, error } = await supabase
            .from("reels_orders_cart_items")
            .select(`
                id,
                quantity,
                status,
                expires_at,
                SKU_variations (
                    color,
                    size
                ),
                SKU_details (
                    id,
                    SKU,
                    regular_price,
                    imageurl,
                    SKU_images (
                        imageurl,
                        imageIndex
                    )
                )
            `)
            .eq("session_id", session.id);

        if (error) {
            console.error("Error fetching cart items:", error);
            return;
        }

        // Log raw response for debugging SKU / image relationships
        // eslint-disable-next-line no-console
        console.log('Raw cart items response:', items);

                // Filter valid items (reserved + not expired OR waitlist)
        const now = new Date();
        const validItems = (items || []).filter((item: any) => {
             if (item.status === 'waitlist') return true;
             if (item.status === 'reserved') {
                 return item.expires_at && new Date(item.expires_at) > now;
             }
             return false;
        });

                // If images are not present via nested relationship, fetch SKU_images directly
                const skuidList = Array.from(new Set(validItems.map((it: any) => it.SKU_details?.id).filter(Boolean)));
                let imagesBySkuid: Record<string, string> = {};
                if (skuidList.length > 0) {
                    const { data: imgs, error: imgErr } = await supabase
                        .from('SKU_images')
                        .select('imageurl, skuid, imageIndex')
                        .in('skuid', skuidList);
                    if (imgErr) {
                        console.error('Error fetching SKU_images fallback:', imgErr);
                    } else if (Array.isArray(imgs)) {
                        // Choose the smallest imageIndex per skuid
                        const bestIndexBySkuid: Record<string, number> = {};
                        imgs.forEach((img: any) => {
                            if (!img || img.skuid == null) return;
                            const key = String(img.skuid);
                            const idx = typeof img.imageIndex === 'number' ? img.imageIndex : 0;
                            if (bestIndexBySkuid[key] === undefined || idx < bestIndexBySkuid[key]) {
                                bestIndexBySkuid[key] = idx;
                                imagesBySkuid[key] = img.imageurl;
                            }
                        });
                    }
                }

        const mappedItems: CartItem[] = validItems.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            variation: {
                color: item.SKU_variations?.color || "",
                size: item.SKU_variations?.size || "",
            },
            product: {
                sku: item.SKU_details?.SKU || "Unknown",
                price: item.SKU_details?.regular_price || 0,
                                image:
                                    // Prefer a direct SKU_images lookup (fetched in imagesBySkuid) first,
                                    // then nested SKU_details.SKU_images, then SKU_details.imageurl
                                    imagesBySkuid[item.SKU_details?.id] ||
                                    (Array.isArray(item.SKU_details?.SKU_images) && item.SKU_details.SKU_images.find((img: any) => img.imageIndex === 0)?.imageurl) ||
                                    item.SKU_details?.imageurl ||
                                    "",
            },
            expires_at: item.expires_at ?? null,
            status: item.status ?? "",
        }));

                setCartItems(mappedItems);
                // More visible debug output for browser console + expose for manual inspection
                // Open browser console and inspect `window.__globalCartLastItems` if you don't see logs.
                // Also use console.log (not console.debug) so it appears in most consoles by default.
                // eslint-disable-next-line no-console
                console.log('Mapped cart items for GlobalCart:', mappedItems);
                // Expose to window for quick inspection in the console
                try {
                    // @ts-ignore
                    window.__globalCartLastItems = mappedItems;
                } catch (e) {
                    /* ignore */
                }
        setIsVisible(mappedItems.length > 0);

      } catch (err) {
        console.error("Cart fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCart();
  }, [sessionToken, refreshTrigger, isOpen]); // Refresh when open to ensure fresh data

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.name || !customerInfo.whatsapp) {
        toast({ title: "請填寫資料", description: "請輸入稱呼及 WhatsApp", variant: "destructive" });
        return;
    }

    setIsCheckingOut(true);
    try {
        const { data, error } = await supabase.rpc('submit_cart_to_reels_order', {
            p_session_token: sessionToken,
            p_customer_name: customerInfo.name,
            p_whatsapp: customerInfo.whatsapp
        });

        if (error) throw error;

        // If reserved_count > 0, redirect to payment page
        const reservedCount = (data as any)?.reserved_count ?? 0;
        if (reservedCount > 0) {
            // Try to find an order id and order number in the response to navigate to specific payment page
            const orderId = (data as any)?.order_id || (data as any)?.id || (data as any)?.order || null;
            const orderNumber = (data as any)?.order_number || (data as any)?.orderNumber || null;
            setIsSubmitted(true);
            setCartItems([]);
            setIsVisible(false);
            setIsOpen(false);
            if (orderNumber) {
                // Prefer using the order_number as the path segment (e.g. /pay/260208-2279)
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
        setIsVisible(false);
        // Refresh token logic? Usually session persists but items are gone.
    } catch (err: any) {
        toast({ title: "錯誤", description: err.message || "結帳失敗", variant: "destructive" });
    } finally {
        setIsCheckingOut(false);
    }
  };

  const removeItem = async (itemId: number) => {
      // Optimistic update
      setCartItems(prev => prev.filter(i => i.id !== itemId));
      
    const { error } = await supabase.from('reels_orders_cart_items').delete().eq('id', itemId);
      if (error) {
          toast({ title: "刪除失敗", variant: "destructive" });
          setRefreshTrigger(prev => prev + 1); // Revert/Reload
      } else {
          // If empty, hide button
          if (cartItems.length <= 1) setIsVisible(false);
      }
  };

  if (!isVisible && !isOpen) return null;

  return (
    <>
            {!isOpen && isVisible && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed top-1/2 right-0 z-[99999] pointer-events-auto bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] p-3 pr-4 rounded-l-xl shadow-lg hover:pr-6 hover:brightness-95 transition-all duration-300 flex items-center gap-2 -translate-y-1/2 animate-in slide-in-from-right-10 fade-in"
                    aria-label="View Cart"
                >
            <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold border border-white">
                    {cartItems.length}
                </span>
            </div>
        </button>
      )}

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="right" className="w-full sm:w-[540px] flex flex-col h-full px-4 sm:px-6 bg-white">
            <SheetHeader>
                <SheetTitle>購物車</SheetTitle>
                <SheetDescription>
                    {isSubmitted ? "訂單已提交" : "請填寫聯絡資料以完成訂單"}
                </SheetDescription>
                {/* Per-item timers shown next to each item */}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 px-2 sm:px-0 space-y-6">
                {isSubmitted ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-3">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                        <h4 className="text-xl font-bold text-green-700">登記成功！</h4>
                        <p className="text-green-600">我們的客服將會盡快透過 WhatsApp 聯繫您確認訂單。</p>
                        <Button className="mt-4 bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" onClick={() => setIsOpen(false)}>
                            關閉
                        </Button>
                    </div>
                ) : (
                    <>
                        {loading && cartItems.length === 0 ? (
                             <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>
                        ) : cartItems.length === 0 ? (
                            <div className="text-center text-zinc-500 py-10">購物車是空的</div>
                        ) : (
                            <div className="space-y-4">
                                {cartItems.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg flex items-stretch gap-4 relative group border border-zinc-100 shadow-sm hover:shadow-md">
                                        <div className="w-24 h-full rounded-md overflow-hidden bg-white shrink-0 flex-shrink-0">
                                            {item.product.image ? (
                                                <img
                                                    src={item.product.image}
                                                    alt={item.product.sku}
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
                                                    <div className="font-bold text-sm">{item.product.sku}</div>
                                                    {(() => {
                                                        const text = item.status === 'reserved'
                                                            ? '現貨'
                                                            : item.status === 'waitlist'
                                                            ? '預訂'
                                                            : item.status;
                                                        return (
                                                            <div className={
                                                                item.status === 'reserved'
                                                                ? 'text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700'
                                                                : 'text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800'
                                                            }>{text}</div>
                                                        );
                                                    })()}
                                                </div>
                                                <button 
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-zinc-400 hover:text-red-500 p-1"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="text-sm text-zinc-500 mt-1">{item.variation.color} / {item.variation.size}</div>
                                            <div className="flex justify-between items-center mt-2">
                                                <div className="font-bold text-[color:var(--color-primary)]">HKD ${item.product.price}</div>
                                                <div className="text-sm text-zinc-500">x {item.quantity}</div>
                                            </div>

                                            {item.expires_at && (
                                                <div className="mt-2 inline-flex flex-col items-start gap-1">
                                                    <div className="text-xs text-red-500">庫存保留倒數</div>
                                                    <div className="text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-mono text-sm animate-pulse">
                                                        {(() => {
                                                            const raw = itemTimers[String(item.id)];
                                                            if (!raw) return "--:--";
                                                            if (raw.length >= 4) return `${raw.slice(0,2)}:${raw.slice(2)}`;
                                                            return raw;
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                <div className="border-t pt-4 flex justify-between items-center font-bold text-lg">
                                    <span>總金額</span>
                                    <span className="text-[color:var(--color-primary)]">HKD ${totalAmount}</span>
                                </div>
                            </div>
                        )}
                        
                        {cartItems.length > 0 && (
                            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4 mt-8 border-t pt-6">
                                <h3 className="font-bold mb-2">聯絡資料</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="checkout-name">稱呼</Label>
                                    <Input
                                        id="checkout-name"
                                        placeholder="請輸入您的稱呼"
                                        value={customerInfo.name}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="checkout-whatsapp">WhatsApp</Label>
                                    <Input
                                        id="checkout-whatsapp"
                                        type="tel"
                                        placeholder="6123 4567"
                                        value={customerInfo.whatsapp}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, whatsapp: e.target.value })}
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full bg-[color:var(--color-primary)] hover:brightness-95 text-[color:var(--color-primary-foreground)] font-bold h-12 mt-4" disabled={isCheckingOut}>
                                    {isCheckingOut ? (
                                        <div className="flex items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            處理中...
                                        </div>
                                    ) : "確認下單"}
                                </Button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
