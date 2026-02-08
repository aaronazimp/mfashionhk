"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, PlayCircle, Zap, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import useSessionToken from "@/hooks/use-session-token";
import { ToastAction } from "@/components/ui/toast";
import NativeVideoPlayer from "./native-video-player";
import { CountdownTimer } from "@/components/countdown-timer";

interface Props {
  id?: string;
  open: boolean;
  onClose: () => void;
  initialProduct?: any;
}

export default function ProductModal({ id, open, onClose, initialProduct }: Props) {
  const [product, setProduct] = useState<any>(initialProduct || null);
  const [loading, setLoading] = useState(!initialProduct);
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();
  const { toast } = useToast();
  const sessionToken = useSessionToken();
  const [selection, setSelection] = useState({ size: "", color: "" });
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!id || initialProduct) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("SKU_details")
        .select(`
          *,
          SKU_variations(id,color,size),
          SKU_images(id,imageurl,"imageIndex")
        `)
        .eq("id", id)
        .single();
      if (!mounted) return;
      if (error) {
        console.error(error);
      } else {
        const images = (data?.SKU_images || [])
          .slice()
          .sort((a: any, b: any) => (Number(a.imageIndex || a['imageIndex'] || 0) - Number(b.imageIndex || b['imageIndex'] || 0)))
          .map((x: any) => x.imageurl)
          .filter(Boolean);
        setProduct({ ...data, images });
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id, initialProduct]);

  useEffect(() => {
    if (!open) setCurrentSlide(0);
  }, [open]);

  if (!open) return null;

  // Build slides: video first (if available), then images
  const slides: Array<{ type: 'video' | 'image'; url: string; poster?: string }> = React.useMemo(() => {
    if (!product) return [];
    const items: Array<{ type: 'video' | 'image'; url: string; poster?: string }> = [];
    const videoUrl = product.reels_video_url || product.feature_video || product.reelsUrl || product.videoUrl;
    if (videoUrl) {
      items.push({ type: 'video', url: videoUrl, poster: product.images?.[0] });
    }
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((u: string) => items.push({ type: 'image', url: u }));
    }
    return items;
  }, [product]);

  const getEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
      const cleanUrl = decodeURIComponent(url);
      const encodedUrl = encodeURIComponent(cleanUrl);
      return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&t=0&autoplay=1&mute=1`;
    }
    if (url.includes('instagram.com') || url.includes('instagr.am')) {
      if (url.includes('/embed')) return url;
      const cleanUrl = url.split('?')[0].replace(/\/$/, '');
      return cleanUrl + '/embed/captioned/';
    }
    return null;
  };

  const openFullscreen = async (idx: number) => {
    const slide = slides[idx];
    if (!slide) return;
    if (slide.type !== 'image') {
      // for video, try opening the URL in a new tab as fallback
      window.open(slide.url, '_blank');
      return;
    }
    const el = document.getElementById(`pm-slide-${idx}`);
    if (el && (el as any).requestFullscreen) {
      try {
        await (el as any).requestFullscreen();
      } catch (e) {
        console.debug('Fullscreen failed', e);
      }
    } else {
      window.open(slide.url, '_blank');
    }
  };

  // variations
  const variations = product?.SKU_variations || product?.sku_variations || [];
  const uniqueColors: string[] = Array.from(new Set(variations.map((v: any) => v.color).filter(Boolean))) as string[];
  const uniqueSizes: string[] = Array.from(new Set(variations.map((v: any) => v.size).filter(Boolean))) as string[];

  const deadlineStr = product?.reels_deadline || product?.deadline;
  const isExpired = React.useMemo(() => {
    if (!deadlineStr) return false;
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return false;
    return d.getTime() <= Date.now();
  }, [product?.reels_deadline, product?.deadline]);

  const handleAddToCart = async () => {
    if (!product) return;
    // if variations exist, require selection
    if (variations.length > 0) {
      if (!selection.color || !selection.size) {
        toast({ description: '請選擇顏色和尺寸' });
        return;
      }
    }

    // find variation id if applicable
    const variation = variations.length > 0 ? variations.find((v: any) => v.color === selection.color && v.size === selection.size) : null;
    if (variations.length > 0 && !variation) {
      toast({ description: '無效的商品選項，請重新選擇' });
      return;
    }

    if (!sessionToken) {
      toast({ description: '請先登入或重新整理頁面' });
      return;
    }

    setIsAddingToCart(true);
    try {
      const rpcParams = {
        p_session_token: sessionToken,
        p_sku_id: parseInt(product.id),
        p_variation_id: variation ? variation.id : null,
        p_qty: 1,
      };
      const { data, error } = await supabase.rpc('add_to_cart', rpcParams as any);
      if (error) throw error;
      const result = data as any;
      if (result && result.success === false) throw new Error(result.message || '無法加入購物車');

      toast({
        description: '已加入購物車',
        duration: 6000,
        action: (
          <>
            <ToastAction
              altText="查看購物車"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event('open-cart'));
                } catch (e) {
                  /* ignore */
                }
              }}
            >
              查看購物車
            </ToastAction>
            <ToastAction
              altText="結帳"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event('open-cart-checkout'));
                } catch (e) {
                  /* ignore */
                }
              }}
            >
              結帳
            </ToastAction>
          </>
        ),
      });
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      console.error('add_to_cart error', err);
      toast({ description: (err as any)?.message || '加入購物車時發生錯誤' });
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-lg z-10 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-bold">商品詳情</div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="p-2" aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="relative aspect-[9/16] bg-zinc-900">
              {slides[currentSlide] ? (
                slides[currentSlide].type === 'video' ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-black">
                    {getEmbedUrl(slides[currentSlide].url) ? (
                      <iframe
                        src={getEmbedUrl(slides[currentSlide].url)!}
                        className="w-full h-full absolute inset-0 border-0 z-10"
                        style={{ border: 'none', overflow: 'hidden' }}
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen={true}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      />
                    ) : (
                      <NativeVideoPlayer url={slides[currentSlide].url} poster={slides[currentSlide].poster} isActive={true} />
                    )}
                  </div>
                ) : (
                  <div id={`pm-slide-${currentSlide}`} className="w-full h-full relative cursor-zoom-in" onClick={(e) => { e.stopPropagation(); openFullscreen(currentSlide); }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                    <Image src={slides[currentSlide].url} alt={product?.SKU || 'product'} fill className="object-top object-cover" />
                  </div>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">No image</div>
              )}
              {slides.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentSlide(s => (s === 0 ? slides.length - 1 : s - 1)) }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 rounded-full">
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentSlide(s => (s + 1) % slides.length) }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 rounded-full">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-3 overflow-x-auto">
              {slides.map((s: { type: string; url: string }, i: number) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentSlide(i) }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className={cn("w-16 h-16 rounded overflow-hidden", currentSlide === i ? "ring-2 ring-[#A87C73]" : "")}>
                  <div className="relative w-full h-full">
                    {s.type === 'video' ? (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><PlayCircle className="w-6 h-6 text-white" /></div>
                    ) : (
                      <Image src={s.url} alt={`thumb-${i}`} fill className="object-top object-cover" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            {loading ? (<div>載入中…</div>) : (
              <>
                <h2 className="text-xl font-bold">{product?.SKU}</h2>
                <div className="text-zinc-500 mt-1">HKD ${product?.regular_price}</div>
                {!isExpired && (product?.reels_deadline || product?.deadline) ? (
                  <div className="mt-2 inline-flex items-center gap-2 text-sm text-red-600">
                    截單倒數: <CountdownTimer targetDate={new Date(product.reels_deadline || product.deadline)} size="sm" />
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-zinc-600">{product?.video_caption || product?.remark}</p>

                {/* variation selectors */}
                {!isExpired && variations.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-2">
                      <Label>顏色</Label>
                      <Select onValueChange={(val) => setSelection({ ...selection, color: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇顏色" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueColors.length > 0 ? uniqueColors.map((c: string) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          )) : <SelectItem value="default">單一顏色</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>尺寸</Label>
                      <Select onValueChange={(val) => setSelection({ ...selection, size: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇尺寸" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueSizes.length > 0 ? uniqueSizes.map((s: string) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          )) : <SelectItem value="one">One size</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  {!isExpired ? (
                    <Button onClick={(e) => { e.stopPropagation(); handleAddToCart(); }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} disabled={isAddingToCart} className="mt-3 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      {isAddingToCart ? '加入中…' : '加入購物車'}
                    </Button>
                  ) : (
                    <div className="rounded p-4 bg-red-50 border border-red-200 text-red-700 font-bold text-center">產品已截單</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
