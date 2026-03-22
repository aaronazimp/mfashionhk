"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import ProductDrawer from '@/components/ProductDrawer'
import { useCallback } from 'react'

type ProductLike = {
  id: string | number;
  reelsUrl?: string | null;
  videoUrl?: string | null;
  name?: string;
};

export function ImmersiveFeed({ products = [], onRegister }: { products?: ProductLike[]; onRegister?: (p: ProductLike) => void; }) {
  const [index, setIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showVolIcon, setShowVolIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(true);
  const [mobileHeight, setMobileHeight] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const router = useRouter();
  const touchStartY = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const touchStartTime = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const wheelCooldown = useRef<number>(0);
  const loadedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // keep active video playing and apply mute state
    const videos = containerRef.current?.querySelectorAll<HTMLVideoElement>("video");
    videos?.forEach((v, i) => {
      if (i === index) {
        v.muted = isMuted;
        // Try to play the active video; ignore promise rejection
        v.play()
          .then(() => {
            // eslint-disable-next-line no-console
            console.log("ImmersiveFeed: playing video index", i, "->", v.currentSrc || v.src);
          })
          .catch(() => {
            // eslint-disable-next-line no-console
            console.log("ImmersiveFeed: play() rejected for video index", i, "->", v.currentSrc || v.src);
          });
      } else {
        v.pause();
      }
    });
  }, [index, isMuted, products]);

  // detect mobile vs desktop to change layout behavior
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Use the actual window.innerHeight on mobile to avoid 100vh browser-UI inconsistencies
  useEffect(() => {
    if (!isMobile) return;
    const update = () => setMobileHeight(window.innerHeight || 0);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isMobile]);

  // Also log when the active index changes
  useEffect(() => {
    const videos = containerRef.current?.querySelectorAll<HTMLVideoElement>("video");
    const active = videos && videos[index];
    if (active) {
      // eslint-disable-next-line no-console
      console.log("ImmersiveFeed: active index changed to", index, "->", active.currentSrc || active.src);
      // if this index already loaded, clear loading; otherwise show spinner
      if (loadedRef.current.has(index)) setIsLoading(false);
      else setIsLoading(true);
    } else {
      // eslint-disable-next-line no-console
      console.log("ImmersiveFeed: active index changed to", index, "-> no video element available yet");
    }
  }, [index, products]);

  // On desktop/tablet, play/pause videos based on visibility while scrolling
  useEffect(() => {
    if (isMobile) return;

    const videos = Array.from(containerRef.current?.querySelectorAll<HTMLVideoElement>("video") || []);
    if (videos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            vid.muted = isMuted;
            vid.play().catch(() => {
              // eslint-disable-next-line no-console
              console.log("ImmersiveFeed: desktop play() rejected for", vid.currentSrc || vid.src);
            });
            // update active index based on visible video
            const idx = videos.indexOf(vid);
            if (idx >= 0 && idx !== index) {
              setIndex(idx);
            }
          } else {
            try { vid.pause(); } catch { /* ignore */ }
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );

    videos.forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [isMobile, products, isMuted]);

  // On desktop, snap to nearest video after scroll stops
  useEffect(() => {
    if (isMobile) return;
    let timer: number | null = null;
    const onScroll = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const vids = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-index]'));
        if (vids.length === 0) return;
        const viewportCenter = window.innerHeight / 2;
        let bestIdx = 0;
        let bestDist = Infinity;
        vids.forEach((v) => {
          const rect = v.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const dist = Math.abs(center - viewportCenter);
          if (dist < bestDist) {
            bestDist = dist;
            const di = Number(v.getAttribute('data-index'));
            bestIdx = Number.isFinite(di) ? di : vids.indexOf(v);
          }
        });
        const targetEl = vids[bestIdx];
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const centerOffset = Math.max(0, (window.innerHeight - rect.height) / 2);
        const targetScroll = window.scrollY + rect.top - centerOffset;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
        setIndex(bestIdx);
      }, 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isMobile]);

  useEffect(() => {
    // when products change, clamp index
    if (index >= products.length) setIndex(Math.max(0, products.length - 1));
  }, [products, index]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(products.length - 1, next));
    if (clamped !== index) setIndex(clamped);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDelta.current = 0;
    touchStartTime.current = performance.now();
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    touchDelta.current = e.touches[0].clientY - touchStartY.current;
    // update drag follow so the container visually follows the finger
    setDragOffset(touchDelta.current);
  };

  const handleTouchEnd = () => {
    const delta = touchDelta.current;
    const start = touchStartTime.current;
    const now = performance.now();
    const dt = start ? Math.max(1, now - start) : 1; // ms
    const velocity = delta / dt; // px per ms

    const h = mobileHeight || window.innerHeight || 0;
    const distanceThreshold = Math.max(60, h * 0.15); // pixels
    const velocityThreshold = 0.35; // px per ms (~350 px/s)

    let next = index;
    if (delta <= -distanceThreshold || velocity <= -velocityThreshold) {
      next = index + 1;
    } else if (delta >= distanceThreshold || velocity >= velocityThreshold) {
      next = index - 1;
    }

    goTo(next);

    // clear drag state so activeTransform transitions into place
    setDragOffset(0);
    touchStartY.current = null;
    touchDelta.current = 0;
    touchStartTime.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelCooldown.current < 350) return;
    if (Math.abs(e.deltaY) < 30) return;
    wheelCooldown.current = now;
    if (e.deltaY > 0) goTo(index + 1);
    else goTo(index - 1);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setShowVolIcon(true);
    window.setTimeout(() => setShowVolIcon(false), 1100);
  };

  // mark a video as loaded (canplay); used to control global spinner
  const markLoaded = (i: number) => {
    loadedRef.current.add(i);
    if (i === index) setIsLoading(false);
    if (products && loadedRef.current.size >= products.length) setIsLoading(false);
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!drawerOpen) setDrawerId(undefined);
  }, [drawerOpen]);

  const openDrawerFor = useCallback((id: string | number) => {
    setDrawerId(String(id));
    setDrawerOpen(true);
  }, []);

  const activeTransform = (() => {
    if (!isMobile) return {} as React.CSSProperties;
    const h = mobileHeight || window.innerHeight || 0;
    const base = -index * h;
    const extra = dragOffset || 0;
    const transitioning = (dragOffset === 0);
    return {
      transform: `translateY(${base + extra}px)`,
      transition: transitioning ? "transform 420ms cubic-bezier(.2,.9,.2,1)" : "none",
    } as React.CSSProperties;
  })();

  return (
    <>
    <div
      ref={containerRef}
      className={isMobile ? "fixed inset-0 bg-black z-50 touch-none" : "relative bg-black"}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onWheel={isMobile ? handleWheel : undefined}
    >
      <div style={isMobile ? { height: `${products.length * (mobileHeight || window.innerHeight || 0)}px`, ...activeTransform } : {}}>
        {products.map((p, i) => (
          <div key={String(p.id)} style={isMobile ? { height: `${mobileHeight || window.innerHeight || 0}px` } : {}} className={`w-full relative ${isMobile ? 'h-screen' : 'flex items-center justify-center py-8'}`}>
            
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(i, el);
                else videoRefs.current.delete(i);
              }}
              data-index={i}
              src={(p.reelsUrl || p.videoUrl) ?? undefined}
              className={isMobile ? "w-full h-full object-cover object-center" : "w-full max-w-3xl max-h-[90vh] object-contain object-center"}
              playsInline
              autoPlay
              loop
              muted={isMuted}
              preload="metadata"
              crossOrigin="anonymous"
              // video click removed — overlay handles clicks/double-clicks
              onCanPlay={(e) => {
                // eslint-disable-next-line no-console
                console.log("ImmersiveFeed: canplay for index", i, "->", (e.target as HTMLVideoElement).currentSrc || (e.target as HTMLVideoElement).src);
                markLoaded(i);
              }}
              onLoadedMetadata={(e) => {
                // eslint-disable-next-line no-console
                console.log("ImmersiveFeed: loadedmetadata for index", i, "duration", (e.target as HTMLVideoElement).duration);
              }}
              onError={(e) => {
                const vid = e.target as HTMLVideoElement;
                // eslint-disable-next-line no-console
                console.log("ImmersiveFeed: video error for index", i, "->", vid.currentSrc || vid.src, vid.error);
                // in case of error, consider this video 'loaded' to avoid indefinite spinner
                markLoaded(i);
              }}
              controls={false}
            />

            <div className="absolute inset-0 pointer-events-none flex items-end justify-center z-30">
              <div className="pointer-events-auto mb-8">
                <button
                  onClick={() => openDrawerFor(p.id)}
                  className="bg-primary text-white px-4 py-2 rounded backdrop-blur"
                >
                  立即購買
                </button>
              </div>
            </div>

            {/* Three-zone overlay: left = rewind (double-click), center = mute toggle, right = fast-forward (double-click) */}
            <div className="absolute inset-0 z-20 pointer-events-auto grid grid-cols-3">
              <div
                className="col-span-1 h-full"
                onClick={(e) => {
                  // use click detail to detect double-click reliably
                  if (e.detail !== 2) return;
                  e.stopPropagation();
                  // eslint-disable-next-line no-console
                  console.log('ImmersiveFeed: dbl click (via detail) rewind zone', i);
                  const v = videoRefs.current.get(i);
                  if (!v) return;
                  try {
                    v.currentTime = Math.max(0, (v.currentTime || 0) - 10);
                    v.play().catch(() => {});
                  } catch {}
                }}
              />
              <div
                className="col-span-1 h-full flex items-center justify-center pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  // eslint-disable-next-line no-console
                  console.log('ImmersiveFeed: center click mute zone', i, 'detail', e.detail);
                  toggleMute();
                }}
              />
              <div
                className="col-span-1 h-full"
                onClick={(e) => {
                  if (e.detail !== 2) return;
                  e.stopPropagation();
                  // eslint-disable-next-line no-console
                  console.log('ImmersiveFeed: dbl click (via detail) forward zone', i);
                  const v = videoRefs.current.get(i);
                  if (!v) return;
                  try {
                    const dur = v.duration || 0;
                    v.currentTime = Math.min(dur, (v.currentTime || 0) + 10);
                    v.play().catch(() => {});
                  } catch {}
                }}
              />
            </div>
            {/* Per-slide mute/unmute overlay (scoped to active slide) */}
            {(i === index && (isMuted || showVolIcon)) && (
              <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                <button
                  aria-label="Toggle mute"
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  style={{ transition: "opacity 220ms ease, transform 220ms ease" }}
                  className={`pointer-events-auto text-white bg-black/40 rounded-full p-2 ${showVolIcon ? "scale-100" : "scale-95"}`}
                >
                  {isMuted ? (
                    <Volume2 size={28} className="text-white" />
                  ) : (
                    <VolumeX size={28} className="text-white" />
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-auto">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
    </div>
      <ProductDrawer id={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
   );
}

export default ImmersiveFeed;
