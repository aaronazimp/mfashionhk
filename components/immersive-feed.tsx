"use client"

import React, { useState, useRef, useEffect } from "react"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { CountdownTimer } from "@/components/countdown-timer"
import NativeVideoPlayer from "./native-video-player"

interface Product {
  id: string
  sku: string
  name: string
  price: number
  images: string[]
  reelsUrl?: string
  deadline?: string | null
  totalQuota?: number
  // Add other fields as needed
}

interface ImmersiveFeedProps {
  products: Product[]
  onRegister: (product: Product) => void
}

function getEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Facebook
  if (url.includes('facebook.com') || url.includes('fb.watch')) {
      const cleanUrl = decodeURIComponent(url);
      return cleanUrl;
  }
  return null;
}

interface FeedItemProps {
    product: Product;
    isActive: boolean;
    shouldLoad: boolean;
    onRegister: (product: Product) => void;
    [key: string]: any; 
}

const FeedItem = React.memo(({ product, isActive, shouldLoad, onRegister, ...props }: FeedItemProps) => {
    // Only parse the FB video if we are active/shouldLoad
    const fbUrl = product.reelsUrl && (product.reelsUrl.includes('facebook.com') || product.reelsUrl.includes('fb.watch')) 
        ? product.reelsUrl 
        : null;

    useEffect(() => {
        // If we have a FB url and this item should load, try to parse XFBML
        if (fbUrl && shouldLoad && (window as any).FB) {
             // We need to wait for init if it hasn't happened. Use a timeout or verify init property?
             // Actually parsing is safe if FB exists, but let's be defensive.
             // We can target specific element ref if possible, but global parse is standard fallback.
             try {
                // Check if init has been called or version is set? 
                // XFBML.parse normally works. The error likely came from missing explicit init before.
                (window as any).FB.XFBML.parse();
             } catch (e) {
                 console.error("FB Parse error", e);
             }
        }
    }, [fbUrl, shouldLoad]);

    return (
        <div
          className="snap-start w-full relative text-white z-0"
          style={{ height: '100dvh' }}
          {...props}
        >
          {/* Main Content Area - Video Only - Absolute Full Screen */}
          <div className="absolute inset-0 bg-zinc-900 w-full h-full overflow-hidden z-0">
            {/* Display video if available, otherwise show image or placeholder */}
            {shouldLoad && fbUrl ? (
                 <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative pointer-events-auto">
                     {/* Facebook SDK Video Div */}
                     <div 
                        className="fb-video" 
                        data-href={fbUrl} 
                        data-width="auto" 
                        data-show-text="false"
                        data-allowfullscreen="true"
                        data-autoplay="false"
                        data-controls="true"
                        style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                     ></div>
                </div>
            ) : shouldLoad && product.reelsUrl ? (
                 <NativeVideoPlayer 
                    url={product.reelsUrl} 
                    poster={product.images?.[0]} 
                    isActive={isActive} 
                 />
            ) : product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover opacity-60"
              />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                    Video Placeholder
                </div>
            )}
            
            {/* No Overlays Here - Pure Video */}
          </div>

          {/* Fixed Bottom Action Area - Overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 px-6 pb-24 pt-12 z-[100] pointer-events-none bg-gradient-to-t from-black/90 via-black/50 to-transparent translate-z-0 transform-gpu">
             
             {/* Info Badges Row */}
            <div className="flex flex-wrap gap-2 items-center justify-center pointer-events-auto">
                {product.deadline ? (
                <div className="inline-flex items-center bg-red-600/90 px-3 py-1 rounded-full text-xs font-bold animate-pulse text-white">
                    截單倒數: <span className="ml-1"><CountdownTimer targetDate={new Date(product.deadline)} size="sm" /></span>
                </div>
                ) : null}

                {/* Low Stock Badge */}
                {product.totalQuota !== undefined && product.totalQuota < 5 && (
                    <div className="inline-flex items-center bg-yellow-500/90 px-3 py-1 rounded-full text-xs font-bold text-black">
                        最後 {product.totalQuota} 件
                    </div>
                )}
            </div>

            {/* Register Button */}
            <button
                type="button"
                // Pointer events fire earlier than click and are more reliable on mobile
                onPointerUp={(e) => {
                   e.preventDefault(); 
                   console.log("Button Pointer Up!", product.sku); 
                   onRegister(product);
                }}
                className="w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg text-white hover:opacity-90 cursor-pointer pointer-events-auto touch-manipulation"
                style={{ backgroundColor: "#A87C73" }}
              >
                <Zap className="w-5 h-5 fill-current" />
                立即登記名額
              </button>
          </div>
        </div>
    )
})

FeedItem.displayName = "FeedItem";

export function ImmersiveFeed({ products, onRegister }: ImmersiveFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true);
    
    // Load FB SDK
    const loadFbSdk = () => {
        if (typeof window === 'undefined') return;

        // Reset if it exists to force init again if needed or ensure clean state
        if (window.document.getElementById('facebook-jssdk')) return;

        (window as any).fbAsyncInit = function() {
            (window as any).FB.init({
              xfbml            : true,
              version          : 'v18.0'
            });
          };

        const fjs = document.getElementsByTagName('script')[0];
        if (fjs && fjs.parentNode) {
            const js = document.createElement('script');
            js.id = 'facebook-jssdk';
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }
    };
    loadFbSdk();

  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const index = Number(entry.target.getAttribute("data-index"))
              if (!isNaN(index)) {
                setActiveIndex((prev) => (prev !== index ? index : prev))
              }
            }
          })
        },
        {
          root: container,
          threshold: 0.6, 
        }
      )

      const elements = container.querySelectorAll("[data-index]")
      elements.forEach((el) => observer.observe(el))

      return () => observer.disconnect()
  }, [products, isMounted])

  if (!isMounted) {
     return <div className="fixed inset-0 bg-black z-50" />
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 w-full overflow-y-scroll snap-y snap-mandatory bg-black pointer-events-auto touch-pan-y",
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      )}
    >
      <div id="fb-root"></div>
      {products.map((product, index) => (
        <FeedItem
          key={product.id}
          product={product}
          data-index={index}
          isActive={index === activeIndex}
          shouldLoad={Math.abs(index - activeIndex) <= 1} 
          onRegister={onRegister}
        />
      ))}
    </div>
  )
}
