"use client"

import React, { useEffect, useMemo, useState, useRef } from 'react'
import Image from 'next/image'
import { Drawer, DrawerPortal, DrawerOverlay, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import LoadingOverlay from '@/components/ui/loading-overlay'
import { getSkuDetailsForDrawer, addToCart } from '@/lib/orderService'
import { SkuDetailsForDrawer } from '@/lib/products'
import * as Lucide from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import useSessionToken from '@/hooks/use-session-token'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import ImageFullscreen from '@/components/ImageFullscreen'
import { CountdownTimer } from '@/components/countdown-timer'
const MDiv: any = motion.div

interface Props {
  id?: string | null
  open: boolean
  onOpenChange?: (open: boolean) => void
}

export default function ProductDrawer({ id, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const sessionToken = useSessionToken()
  const searchParams = useSearchParams()
  const isAddedFromUpsellParam = (() => {
    try {
      const v = searchParams?.get('is_added_from_upsell')
      if (v === null || typeof v === 'undefined') return undefined
      if (v === '1' || v === 'true') return true
      if (v === '0' || v === 'false') return false
      return v
    } catch (e) {
      return undefined
    }
  })()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<SkuDetailsForDrawer | any>(null)
  const [slides, setSlides] = useState<Array<any>>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selection, setSelection] = useState({ size: '', color: '' })
  const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const thumbRef = useRef<HTMLButtonElement | null>(null)
  const [galleryStartRect, setGalleryStartRect] = useState<DOMRect | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [drawerDirection, setDrawerDirection] = useState<'bottom' | 'right'>('bottom')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const update = (e: any) => setDrawerDirection(e.matches ? 'right' : 'bottom')
    update(mq)
    if (mq.addEventListener) mq.addEventListener('change', update)
    else mq.addListener(update)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update)
      else mq.removeListener(update)
    }
  }, [])

  useEffect(() => {
    if (!open || !id) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      let data: any = null
      try {
        data = await getSkuDetailsForDrawer(parseInt(id as string, 10))
      } catch (error) {
        if (!mounted) return
        console.error(error)
        setLoading(false)
        return
      }
      if (!mounted) return
      // Map RPC output (`SkuDetailsForDrawer`) into the shape expected by this component
      const images = (data?.images || [])
        .slice()
        .sort((a: any, b: any) => (Number(a.index || 0) - Number(b.index || 0)))
        .map((x: any) => x.url)
        .filter(Boolean)

      const videoUrl = data?.reels_video_url || data?.feature_video || null
      const slideItems: Array<any> = []
      if (videoUrl) slideItems.push({ type: 'video', url: videoUrl, poster: images[0] })
      images.forEach((u: string) => slideItems.push({ type: 'image', url: u }))

      // Flatten RPC variations -> SKU_variations(id,color,size) to preserve existing UI logic
      const rpcVariations = data?.variations || []
      const flattened: Array<any> = []
      rpcVariations.forEach((v: any) => {
        const size = v?.size
        ;(v?.options || []).forEach((opt: any) => {
          flattened.push({ id: opt.id, color: opt.color || '', size })
        })
      })

      setProduct({ ...data, images, SKU_variations: flattened })
      setSlides(slideItems)
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [open, id])

  // when drawer closes we close the gallery; do not auto-reopen when drawer reopens
  useEffect(() => {
    if (!open) {
      setIsGalleryOpen(false)
    }
  }, [open])

  const variations = product?.SKU_variations || []

  // Use grouped RPC `variations` to build the table (sizes × colors)
  const groupedVariations = product?.variations || []
  const tableSizes: string[] = useMemo(() => groupedVariations.map((v: any) => v.size).filter(Boolean), [product])
  const tableColors: string[] = useMemo(() => Array.from(new Set((groupedVariations.flatMap((v: any) => (v.options || []).map((o: any) => o.color))).filter(Boolean))), [product])
  // When a size is selected, only show colors available for that size
  const colorsToShow: string[] = useMemo(() => {
    if (!selection.size) return tableColors
    const sizeRow = groupedVariations.find((r: any) => r.size === selection.size)
    return Array.from(new Set((sizeRow?.options || []).map((o: any) => o.color).filter(Boolean)))
  }, [selection.size, groupedVariations, tableColors])

  // Auto-select first available size & color when drawer opens and nothing selected
  // Always auto-select the first available size+color option whenever the drawer opens
  useEffect(() => {
    if (!open || !product) return

    const grouped = product?.variations || []
    const allOptions = grouped.flatMap((r: any) => (r.options || []).map((o: any) => ({ ...o, size: r.size })))
    // stock is no longer returned from the API; just pick the first option
    const firstAvailable = allOptions[0]

    if (firstAvailable) {
      setSelection({ size: firstAvailable.size || '', color: firstAvailable.color || '' })
      setSelectedVariationId(firstAvailable.id || null)
      return
    }

    // Fallbacks if grouped is empty: prefer sizes then colors
    const localTableSizes = grouped.map((v: any) => v.size).filter(Boolean)
    const localTableColors = Array.from(new Set((grouped.flatMap((v: any) => (v.options || []).map((o: any) => o.color))).filter(Boolean)))

    if (localTableSizes.length > 0) {
      const firstSize = localTableSizes[0]
      const sizeRow = grouped.find((r: any) => r.size === firstSize)
      const opt = (sizeRow?.options || [])[0]
      const color = opt?.color || ''
      setSelection({ size: firstSize, color })
      setSelectedVariationId(opt ? opt.id : null)
      return
    }

    if (localTableColors.length > 0) {
      const firstColor = String(localTableColors[0] || '')
      const found = grouped.flatMap((r: any) => (r.options || [])).find((o: any) => o.color === firstColor)
      setSelection({ size: '', color: firstColor })
      setSelectedVariationId(found ? found.id : null)
    }
  }, [open, product?.id])

  const handleAddToCart = async () => {
    if (!product) return
    if (variations.length > 0) {
      if (!selection.color || !selection.size) {
        toast({ description: '請選擇顏色和尺寸' })
        return
      }
    }

    const variation = variations.length > 0 ? variations.find((v: any) => v.color === selection.color && v.size === selection.size) : null
    if (variations.length > 0 && !variation) {
      toast({ description: '無效的商品選項，請重新選擇' })
      return
    }

    if (!sessionToken) {
      toast({ description: '無法建立工作階段，請重新整理頁面' })
      return
    }

    setIsAddingToCart(true)
    try {
      const rpcParams: any = {
        p_session_token: sessionToken,
        p_sku_id: parseInt(product.id),
        p_variation_id: variation ? variation.id : null,
        p_qty: 1,
      }
      if (typeof isAddedFromUpsellParam !== 'undefined') rpcParams.p_is_added_from_upsell = isAddedFromUpsellParam
      await addToCart(rpcParams.p_session_token, rpcParams.p_sku_id, rpcParams.p_variation_id, rpcParams.p_qty, rpcParams.p_is_added_from_upsell)
      toast({
        description: '已加入購物車',
        duration: 3000,
        action: (
          <>
           
            <ToastAction
              className="bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] border-transparent hover:brightness-95"
              altText="結帳"
              onClick={() => {
                try { window.dispatchEvent(new Event('open-cart-checkout')) } catch (e) { }
              }}
            >
              結帳
            </ToastAction>
          </>
        ),
      })
      window.dispatchEvent(new Event('cart-updated'))
    } catch (err) {
      console.error('add_to_cart error', err)
      toast({ description: (err as any)?.message || '加入購物車時發生錯誤' })
    } finally {
      setIsAddingToCart(false)
    }
  }

  // when content area is scrolled to top and user scrolls up, vaul should snap to full; to approximate,
  // we expose a small handler that sets expanded state when user scrolls inside the content area upwards.
  const onInnerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    // if the user scrolls up beyond top (negative) or scrollTop === 0 and wheel delta negative, expand
    if (el.scrollTop === 0 && (e as any).nativeEvent?.deltaY < 0) {
      setIsExpanded(true)
    }
  }



  const openGalleryFromThumb = (index: number) => {
    const s = slides[index]
    if (!s) return
    if (s.type !== 'image') {
      // currently only images are shown in the fullscreen viewer
      return
    }
    const el = thumbRef.current
    if (!el) {
      setGalleryIndex(index)
      setIsGalleryOpen(true)
      return
    }
    const rect = el.getBoundingClientRect()
    setGalleryStartRect(rect)
    setGalleryIndex(index)
    setIsGalleryOpen(true)
  }

  const closeGallery = () => {
    setIsGalleryOpen(false)
    setGalleryStartRect(null)
  }

  // ensure Escape key closes gallery even if overlay isn't focused
  React.useEffect(() => {
    if (!isGalleryOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery()
      if (e.key === 'ArrowLeft') {
        // find previous image index
        const imageSlides = slides.filter((s) => s.type === 'image')
        if (imageSlides.length === 0) return
        const cur = imageSlides.findIndex((s) => s.url === (slides[galleryIndex]?.url))
        const prev = Math.max(0, cur - 1)
        const globalPrevIndex = slides.findIndex((s) => s.type === 'image' && s.url === imageSlides[prev].url)
        if (globalPrevIndex >= 0) setGalleryIndex(globalPrevIndex)
      }
      if (e.key === 'ArrowRight') {
        const imageSlides = slides.filter((s) => s.type === 'image')
        if (imageSlides.length === 0) return
        const cur = imageSlides.findIndex((s) => s.url === (slides[galleryIndex]?.url))
        const next = Math.min(imageSlides.length - 1, cur + 1)
        const globalNextIndex = slides.findIndex((s) => s.type === 'image' && s.url === imageSlides[next].url)
        if (globalNextIndex >= 0) setGalleryIndex(globalNextIndex)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isGalleryOpen])

  // Button enable/disable state: require size+color when SKU has variations
  const needsVariationSelection = variations.length > 0
  const isSelectionComplete = Boolean(selection.size && selection.color)
  const buyDisabled = isAddingToCart || (needsVariationSelection && !isSelectionComplete)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={drawerDirection}>
      <DrawerPortal>
        <DrawerOverlay className="backdrop-blur-sm bg-black/30" />
        <DrawerContent className="touch-none items-start">
          <DrawerTitle className="sr-only">商品詳情</DrawerTitle>
          <div className="flex flex-col w-full h-auto">
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b">
              <div className="px-4 py-3 mt-4">
                <div className="text-md font-semibold">{product?.SKU || 'SKU NAME'}</div>

                <div className="flex justify-between gap-3 mt-1">
                  <div className="text-md font-bold">${product?.regular_price ?? '0'}</div>
                  
                  <div className="text-sm text-zinc-500">🔥 99人已購買</div>
                </div>

                {(product?.reels_deadline || product?.deadline) && (
                  <div className="flex items-right mt-2 text-sm">
                    截單時間: <CountdownTimer targetDate={new Date(product.reels_deadline || product.deadline)} size="sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails strip (visible collapsed) */}
            <div className="px-4 py-3">
              <div className="py-3">
                <div className="overflow-x-auto touch-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="inline-flex gap-3 whitespace-nowrap">
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => openGalleryFromThumb(i)} className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-zinc-100">
                        {s.type === 'video' ? (
                          <video src={s.url} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <Image src={s.url} alt={`img-${i}`} fill className="object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle: variation selectors (choice chip style) */}
              <div className="px-4 py-3">
                <div className="text-[10px] text-zinc-700 mb-2 text-center">選擇尺寸與顏色</div>
                {tableSizes.length === 0 || tableColors.length === 0 ? (
                  <div className="text-zinc-500 text-sm text-center mt-9">已售罄</div>
                ) : (
                  <div className="space-y-3">
                    {/* Size chips */}
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-2">尺碼</div>
                      <div className="overflow-x-auto touch-auto pb-1">
                        <div className="inline-flex items-center gap-3 whitespace-nowrap">
                        {tableSizes.map((size) => {
                          const sizeRow = groupedVariations.find((r: any) => r.size === size)
                          // stock is no longer returned; a size is available if it has any options
                          const available = (sizeRow?.options || []).length > 0
                          const selected = selection.size === size
                          return (
                            <button
                              key={size}
                              onClick={() => {
                                const opts = sizeRow?.options || []
                                const colorExists = opts.some((o: any) => o.color === selection.color)
                                const newColor = colorExists ? selection.color : (opts[0]?.color || '')
                                const matched = opts.find((o: any) => o.color === newColor)
                                setSelection((s) => ({ ...s, size, color: newColor }))
                                setSelectedVariationId(matched ? matched.id : null)
                              }}
                              disabled={!available}
                              aria-pressed={selected}
                              className={`text-xs px-4 py-2 rounded-full border transition-colors flex-shrink-0 ${selected ? 'bg-zinc-300 text-black border-transparent' : available ? 'bg-white text-zinc-900 border-zinc-300' : 'bg-zinc-100 text-zinc-400 border-transparent'}`}
                            >
                              {size}
                            </button>
                          )
                        })}
                        </div>
                      </div>
                    </div>

                    {/* Color chips */}
                    <div>
                      <div className="text-[10px] text-zinc-500 mb-2">顏色</div>
                      <div className="overflow-x-auto touch-auto pb-1">
                        <div className="inline-flex items-center gap-3 whitespace-nowrap">
                        {colorsToShow.map((color) => {
                          // colorsToShow already filters by selected size when applicable
                          const colorAvailable = selection.size
                            ? true
                            : groupedVariations.some((r: any) => (r.options || []).some((o: any) => o.color === color))
                          const selected = selection.color === color
                          return (
                            <button
                              key={color}
                              onClick={() => {
                                let matchedId: number | null = null
                                let newSize = selection.size
                                if (selection.size) {
                                  const sizeRow = groupedVariations.find((r: any) => r.size === selection.size)
                                  matchedId = sizeRow?.options?.find((o: any) => o.color === color)?.id ?? null
                                } else {
                                  const found = groupedVariations.flatMap((r: any) => (r.options || []).map((o: any) => ({ ...o, size: r.size }))).find((o: any) => o.color === color)
                                  if (found) {
                                    newSize = found.size
                                    matchedId = found.id
                                  }
                                }
                                setSelection((s) => ({ ...s, color, size: newSize }))
                                setSelectedVariationId(matchedId)
                              }}
                              disabled={!colorAvailable}
                              aria-pressed={selected}
                              className={`text-xs px-4 py-2 rounded-full border transition-colors flex-shrink-0 ${selected ? 'bg-zinc-300 text-black border-transparent' : colorAvailable ? 'bg-white text-zinc-900 border-zinc-300' : 'bg-zinc-100 text-zinc-400 border-transparent'}`}
                            >
                              {color}
                            </button>
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Expandable content: gallery + description */}
            <div onScroll={onInnerScroll} className={`overflow-auto px-4 pt-2 pb-16 ${isExpanded ? 'h-[85vh]' : 'h-auto'}`}>
              {loading ? (
                <LoadingOverlay message="載入中…" />
              ) : (
                <>
                       

                 

                  {/* Description (only when exists) */}
                  {(product?.video_caption || product?.remark) && (
                    <div className="mt-2 text-sm text-zinc-700">
                      <div className="font-semibold mb-2">商品描述</div>
                      <div className="prose max-w-none text-zinc-700">{product.video_caption || product.remark}</div>
                      <div className="h-40" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom fixed add-to-cart (hidden when no variations returned) */}
            {(groupedVariations.length === 0 && variations.length === 0) ? null : (
              <div className="fixed left-0 right-0 bottom-4 px-4 z-30">
                <div className="max-w-lg mx-auto">
                  <div className="flex justify-center">
                    <button
                      onClick={handleAddToCart}
                      disabled={buyDisabled}
                      aria-disabled={buyDisabled}
                      className={`mx-auto w-48 rounded-xl py-3 text-sm ${buyDisabled ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed' : 'bg-primary text-white'}`}
                    >
                      {isAddingToCart ? '加入中…' : '立即購買'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
        {/* Fullscreen handled by global ImageFullscreen; local overlay removed. */}
        {/* Use global ImageFullscreen for single-image viewing */}
        {isGalleryOpen && (() => {
          const imageSlides = slides.filter(s => s.type === 'image')
          // find index within imageSlides for current galleryIndex; fallback to 0
          const currentImage = slides[galleryIndex] && slides[galleryIndex].type === 'image' ? slides[galleryIndex] : (imageSlides[0] || null)
          return currentImage ? (
            <ImageFullscreen
              src={currentImage.url}
              alt={product?.SKU || ''}
              open={isGalleryOpen}
              onClose={closeGallery}
              showCaption={!!product?.video_caption}
              caption={product?.video_caption}
            />
          ) : null
        })()}
      </DrawerPortal>
    </Drawer>
  )
}
