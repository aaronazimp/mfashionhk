"use client";

import React, { useState, useRef, use } from "react";
import Image from "next/image";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, PlayCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/countdown-timer";
import NativeVideoPlayer from "@/components/native-video-player";
import { registerReelsOrder } from "../actions";

function getEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;
  
  // Facebook
  if (url.includes('facebook.com') || url.includes('fb.watch')) {
     const cleanUrl = decodeURIComponent(url);
     const encodedUrl = encodeURIComponent(cleanUrl);
     return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&t=0&autoplay=1&mute=1`;
  }
  
  // Instagram
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
      if (url.includes('/embed')) return url;
      // Strip query params and trailing slash
      const cleanUrl = url.split('?')[0].replace(/\/$/, '');
      return cleanUrl + '/embed/captioned/';
  }

  return null;
}

// Options as inferred from previous file context
const sizeOptions = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
  { value: "xxl", label: "XXL" },
];

interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  price: number;
  description: string;
  images: string[];
  colors: string[];
  sizes: string[];
  variations: { id: number; color: string; size: string }[];
  reelsUrl: string;
  videoUrl: string;
  originalPrice: number | null;
  deadline: string | null;
}

export default function FlashSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('SKU_details')
        .select(`
          *,
          SKU_variations (
            id,
            color,
            size
          )
        `)
        .eq('id', id)
        .eq('is_reels_active', true)
        .single();
      
      if (error) {
        console.error('Error fetching product:', error);
      }
      
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variations = data.SKU_variations || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueColors = Array.from(new Set(variations.map((v: any) => v.color).filter(Boolean))) as string[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueSizes = Array.from(new Set(variations.map((v: any) => v.size).filter(Boolean))) as string[];

        setProduct({
          id: data.id.toString(),
          sku: data.SKU,
          name: data.SKU, // Using SKU as name since no name column
          price: data.regular_price,
          description: data.video_caption || data.remark || "",
          images: data.imageurl ? [data.imageurl] : [],
          colors: uniqueColors.length > 0 ? uniqueColors : [],
          sizes: uniqueSizes.length > 0 ? uniqueSizes : [],
          variations: variations,
          reelsUrl: data.reels_video_url,
          videoUrl: data.feature_video,
          originalPrice: null, // No original price in schema
          deadline: data.reels_deadline,
        });
      }
      setLoading(false);
    }
    fetchProduct();
  }, [id]);

  // State from previous flash sale page
  const [currentSlide, setCurrentSlide] = useState(0); 
  // Determine media items: First item is video (if exists or strictly "always" per request implies checking logic
  // but to be safe with "always show reel video", we will attempt to show a video player for slide 0 
  // if a reel URL is present, or a placeholder if intended.
  // Assuming "always show" means "The UI slot 0 is reserved for video".
  
  // Let's create a unified slides array
  const slides = React.useMemo(() => {
     if (!product) return [];
     const items = [];
     
     // Always add video slide first if url exists, or maybe just mock it for "ensure...always" ?
     // I'll add a video slide if reelsUrl/videoUrl exists. 
     // If the user meant "mock it up so I can see it", I should probably add a mock video url to the product manually or handling code.
     // I will treat "always show" as "Display video player UI for the first slide".
     
     // For this iteration, I'll assume every product has a "video slot" at index 0.
     // If no URL is provided, I'll show a "Video Placeholder".
     items.push({
         type: 'video',
         url: product.reelsUrl || product.videoUrl || "", // Empty string triggers placeholder
         poster: product.images?.[0] || "/placeholder.svg"
     });

     // Add images
     if (product.images) {
         product.images.forEach(img => items.push({ type: 'image', url: img }));
     } else {
         items.push({ type: 'image', url: "/placeholder.svg" });
     }
     
     return items;
  }, [product]);

  // Mock registered user count
  const registeredCount = React.useMemo(() => {
    return 100 + Math.floor(Math.random() * 500); 
  }, []); // Stable random number per mount

  const [isSubmitted, setIsSubmitted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", whatsapp: "", size: "", color: "" });
  
  const formRef = useRef<HTMLDivElement>(null);

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
  }

  if (!product) {
      return <div className="p-10 text-center">Product not found</div>;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    // Validate
    if (!formData.name || !formData.whatsapp) {
        setError("請填寫所有必填欄位");
        return;
    }
    setError("");

    // Find variation ID
    const variation = product.variations?.find(v => v.color === formData.color && v.size === formData.size);
    const variationId = variation ? variation.id : 0;

    const payload = new FormData();
    payload.set('name', formData.name);
    payload.set('whatsapp', formData.whatsapp);
    payload.set('email', '');
    payload.set('skuId', product.id);
    payload.set('variationId', variationId.toString());
    payload.set('skuSnapshot', product.sku);
    payload.set('variationSnapshot', `${formData.color} / ${formData.size}`);
    payload.set('price', Math.round(product.price).toString());

    try {
      const result = await registerReelsOrder(payload);
      if (result?.error) {
         setError(result.error);
      }
    } catch (err) {
      console.error('Error submitting order:', err);
      setError("提交訂單時發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Sticky Header Group */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm">
          {/* Nav Row */}
          <div className="px-4 py-3 flex items-center justify-between">
            <Link href="/flash-sale" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full">
                <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="font-bold text-lg">限時搶購</div>
            <div className="w-8"></div> {/* Spacer */}
          </div>
          
          {/* Countdown Bar */}
          {product?.deadline && (
            <div className="bg-red-50 text-red-600 py-1.5 flex items-center justify-center gap-2 text-sm border-t border-red-100/50">
                <span className="animate-pulse">🔥</span>
                <span className="font-bold">搶購倒數</span>
                <CountdownTimer targetDate={new Date(product.deadline)} size="sm" />
            </div>
          )}
      </div>

      <div className="max-w-md mx-auto relative">
        {/* Media Section (Video or Carousel) */}
        <div className="relative aspect-[3/4] bg-zinc-900 w-full overflow-hidden">
             
             {/* Slide Content */}
             {slides[currentSlide].type === 'video' ? (
                 <div className="w-full h-full relative flex items-center justify-center bg-black">
                     {slides[currentSlide].url ? (
                        getEmbedUrl(slides[currentSlide].url) ? (
                            <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
                             <iframe 
                                src={getEmbedUrl(slides[currentSlide].url)!}
                                className="w-full h-full absolute inset-0 border-0 z-10 pointer-events-auto"
                                style={{ border: 'none', overflow: 'hidden' }} 
                                scrolling="no" 
                                frameBorder="0" 
                                allowFullScreen={true}
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                              />
                            </div>
                        ) : (
                            <NativeVideoPlayer 
                                url={slides[currentSlide].url} 
                                poster={slides[currentSlide].poster}
                                isActive={true}
                            />
                        )
                     ) : (
                         /* Video Placeholder when URL missing */
                         <div className="text-zinc-500 flex flex-col items-center">
                             <div className="w-16 h-16 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-2">
                                 <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-zinc-500 border-b-[10px] border-b-transparent ml-1"></div>
                             </div>
                             <span className="text-sm">Video Preview Unavailable</span>
                         </div>
                     )}
                     
                     {/* Badge for Video */}
                     <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                         Reel
                     </div>
                 </div>
             ) : (
                <Image
                    src={slides[currentSlide].url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    priority={currentSlide === 0}
                />
             )}

             {/* Carousel Indicators */}
             {slides.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {slides.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${currentSlide === idx ? 'bg-white' : 'bg-white/40'}`}
                        />
                    ))}
                </div>
             )}
             
             {/* Simple carousel controls */}
             {slides.length > 1 && (
                 <>
                    <button 
                        onClick={() => setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors z-10"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                         onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
                         className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors z-10"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                 </>
             )}
        </div>

        {/* Thumbnail Preview */}
        {slides.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-5 py-4">
                {slides.map((slide, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={cn(
                            "relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                            currentSlide === idx ? "border-[#A87C73]" : "border-transparent opacity-70"
                        )}
                    >
                        {slide.type === 'video' ? (
                             <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                 <PlayCircle className="w-6 h-6 text-white" />
                             </div>
                        ) : (
                             <Image
                                 src={slide.url}
                                 alt={`Thumbnail ${idx}`}
                                 fill
                                 className="object-cover"
                             />
                        )}
                    </button>
                ))}
            </div>
        )}

        {/* Product Details Block */}
        <div className="p-5 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                     <h1 className="text-2xl font-bold">{product.sku}</h1>
                     <div className="text-sm text-zinc-500 mt-1">貨號：{product.sku}</div>
                     {/* Registered Users Count */}
                     <div className="flex items-center gap-2 mt-3 text-sm font-medium text-orange-800 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full w-fit shadow-sm animate-in fade-in slide-in-from-left-2 duration-700">
                         <div className="flex -space-x-2 mr-1">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative">
                                    <Image src={`/placeholder.svg?height=30&width=30&text=${i}`} alt="user" fill className="object-cover" />
                                </div>
                            ))}
                         </div>
                         <span className="flex items-center gap-1">
                            <span className="font-bold">{registeredCount}</span>
                            <span>人已登記搶購</span>
                            <span className="relative flex h-2 w-2 ml-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                         </span>
                     </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-[#A87C73]">HKD ${product.price}</div>
                    {product.originalPrice && (
                        <div className="text-sm text-zinc-400 line-through">HKD ${product.originalPrice}</div>
                    )}
                </div>
            </div>

            <p className="text-zinc-600 text-sm leading-relaxed">
                {product.description}
            </p>
        </div>

        {/* Fast Checkout Form */}
        <div className="p-5 bg-zinc-50 border-t" ref={formRef}>
            <div className="mb-6">
                <h3 className="text-lg font-bold mb-4">快速下單</h3>
                
                {isSubmitted ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-3">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                        <h4 className="text-xl font-bold text-green-700">登記成功！</h4>
                        <p className="text-green-600">我們的客服將會盡快透過 WhatsApp 聯繫您確認訂單。</p>
                        <Button 
                            className="mt-4 bg-[#A87C73] hover:bg-[#8f6a62]" 
                            onClick={() => router.push('/flash-sale')}
                        >
                            繼續瀏覽
                        </Button>
                    </div>
                ) : (
                    <form id="flash-sale-form" onSubmit={handleSubmit} className="space-y-4">
                         {/* Size & Color Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>顏色</Label>
                                <Select onValueChange={(val) => setFormData({...formData, color: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="選擇顏色" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {product.colors?.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        )) || <SelectItem value="default">單一顏色</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>尺寸</Label>
                                <Select onValueChange={(val) => setFormData({...formData, size: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="選擇尺寸" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {product.sizes?.map(s => ( // Use dynamic sizes if available
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        )) || sizeOptions.map(s => (
                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">稱呼</Label>
                            <Input 
                                id="name" 
                                placeholder="請輸入您的稱呼" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">WhatsApp</Label>
                            <Input 
                                id="whatsapp" 
                                type="tel" 
                                placeholder="6123 4567" 
                                value={formData.whatsapp}
                                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                required
                            />
                        </div>

                       {/* Spacer to not hide the last input behind sticky footer */}
                       <div className="h-12"></div>
                    </form>
                )}
            </div>
        </div>

        {/* Sticky Bottom Buy Button */}
        {!isSubmitted && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 safe-area-bottom">
                 <div className="max-w-md mx-auto flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm text-zinc-500">總金額</span>
                        <span className="text-xl font-bold text-[#A87C73]">HKD ${product.price}</span>
                    </div>
                    <Button 
                        type="submit" 
                        form="flash-sale-form" 
                        className="flex-1 bg-gradient-to-r from-[#A87C73] to-[#d49e92] hover:brightness-110 text-white text-xl font-bold h-14 rounded-full shadow-[0_0_15px_rgba(168,124,115,0.6)] active:scale-95 transition-all"
                    >
                        <Zap className="w-6 h-6 mr-2 fill-yellow-300 text-yellow-100 animate-pulse" />
                        立即搶購
                    </Button>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
}
