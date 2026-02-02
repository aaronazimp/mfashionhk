"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Product } from "@/lib/products"
import { Calendar } from "@/components/ui/calendar"
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
  DialogClose,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Plus, 
  Trash2, 
  Save, 
  Upload,
  X,
  Loader2,
  Video
} from "lucide-react"

function getEmbedUrl(url: string) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    
    // Instagram (Reels, Posts, TV)
    if (urlObj.hostname.includes('instagram.com')) {
        const match = urlObj.pathname.match(/\/(reel|p|tv)\/([a-zA-Z0-9_-]+)/);
        if (match && match[2]) {
            return `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`;
        }
    }

    // Facebook
    if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('fb.watch')) {
         return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0`;
    }
  } catch (e) {
      console.error("Invalid URL for embed:", e);
  }
  return null;
}

interface SkuEditorProps {
  initialProduct: Product
}

export default function SkuEditor({ initialProduct }: SkuEditorProps) {
  const [product, setProduct] = useState<Product>(initialProduct)
  // Lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const [isChanged, setIsChanged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [colorsInput, setColorsInput] = useState(initialProduct.colors?.join(', ') || '')
  const [sizesInput, setSizesInput] = useState(initialProduct.sizes?.join(', ') || '')

  // Handlers for basic input changes
  const handleChange = (field: keyof Product, value: any) => {
    setProduct(prev => ({ ...prev, [field]: value }))
    setIsChanged(true)
    setMessage(null)
  }

  // Handlers for array inputs (comma separated)
  const handleColorsChange = (value: string) => {
    // Replace Chinese comma with English comma
    const normalizedValue = value.replace(/，/g, ',')
    setColorsInput(normalizedValue)
    
    // Parse for product state
    const array = normalizedValue.split(',').map(s => s.trim()).filter(Boolean)
    setProduct(prev => ({ ...prev, colors: array }))
    setIsChanged(true)
    setMessage(null)
  }

  const handleSizesChange = (value: string) => {
    // Replace Chinese comma with English comma
    const normalizedValue = value.replace(/，/g, ',')
    setSizesInput(normalizedValue)
    
    // Parse for product state
    const array = normalizedValue.split(',').map(s => s.trim()).filter(Boolean)
    setProduct(prev => ({ ...prev, sizes: array }))
    setIsChanged(true)
    setMessage(null)
  }

  // Image handlers
  const handleAddImage = () => {
    const url = prompt("請輸入圖片網址 (URL):")
    if (url) {
      setProduct(prev => ({ ...prev, images: [...prev.images, url] }))
      setIsChanged(true)
      setMessage(null)
    }
  }

  const handleRemoveImage = (index: number) => {
    setProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
    if (currentSlide >= index && currentSlide > 0) {
      setCurrentSlide(c => c - 1)
    }
    setIsChanged(true)
    setMessage(null)
  }
  
  // Media items for lightbox (Video + Images)
  const mediaItems = [
    ...(product.reelsUrl ? [{ type: 'video', url: product.reelsUrl }] : []),
    ...product.images.map(url => ({ type: 'image', url }))
  ]

  const nextSlide = () => {
    if (mediaItems.length === 0) return
    setCurrentSlide((prev) => (prev + 1) % mediaItems.length)
  }

  const prevSlide = () => {
    if (mediaItems.length === 0) return
    setCurrentSlide((prev) =>
      prev === 0 ? mediaItems.length - 1 : prev - 1
    )
  }

  const handleSave = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalSku: initialProduct.sku,
          update: {
            ...product, // Send the full updated product object
            // Ensure numbers are numbers
            price: Number(product.price),
            originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined
          }
        })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Update failed');
      setMessage('更新成功');
      setIsChanged(false);
    } catch (err: any) {
      setMessage(err?.message || '更新失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 md:items-start">
        
        {/* Left Column: Media (Video/Images) */}
        <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-200 p-6">
          
          <div className="flex items-center justify-between mb-4">
             <Label className="text-lg font-medium">媒體庫 ({mediaItems.length})</Label>
             <Button onClick={handleAddImage} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" /> 新增圖片
             </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
             {/* Reels Item - Always First */}
             {product.reelsUrl && (
                <div 
                  className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden cursor-pointer group hover:ring-2 ring-primary transition-all"
                  onClick={() => { setCurrentSlide(0); setIsLightboxOpen(true); }}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90">
                       <Play className="w-8 h-8 mb-2" />
                       <span className="text-xs font-medium">Reels/Video</span>
                    </div>
                </div>
             )}

             {/* Images */}
             {product.images.map((img, idx) => {
                // Adjust index if reelsUrl exists
                const mediaIndex = (product.reelsUrl ? 1 : 0) + idx;
                return (
                    <div 
                      key={idx} 
                      className="relative aspect-[3/4] border rounded-lg overflow-hidden cursor-pointer group bg-gray-50 hover:ring-2 ring-primary transition-all"
                      onClick={() => { setCurrentSlide(mediaIndex); setIsLightboxOpen(true); }}
                    >
                       <Image src={img} alt={`Image ${idx + 1}`} fill className="object-cover" />
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                         className="absolute top-1 right-1 bg-white/90 text-red-600 hover:bg-red-600 hover:text-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                       >
                          <X className="w-3 h-3" />
                       </button>
                    </div>
                )
             })}
          </div>

          {/* Video Inputs */}
          <div className="mt-8 pt-6 border-t space-y-4">
             <div className="space-y-2">
                 <Label className="text-sm font-medium flex items-center gap-2">
                    <Video className="w-4 h-4" /> Loop / Reels URL
                 </Label>
                 <Input 
                    value={product.reelsUrl || ''} 
                    onChange={e => handleChange('reelsUrl', e.target.value)}
                    placeholder="https://instagram.com/..." 
                    className="text-sm"
                 />
                 <p className="text-xs text-muted-foreground">如果有影片連結，將會顯示在媒體庫的第一位。</p>
             </div>
          </div>

        </div>

        {/* Right Column: Details Editor */}
        <div className="flex flex-col h-full bg-white">
          <div className="p-6 space-y-6">
             
             {/* Header Info */}
             <div className="space-y-4 border-b pb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">SKU Name: {product.sku}</span>
                    {isChanged && <span className="text-xs text-amber-600 font-medium animate-pulse">未儲存變更</span>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">商品名稱</Label>
                    <Input 
                        id="name" 
                        value={product.name} 
                        onChange={e => handleChange('name', e.target.value)}
                        className="text-lg font-medium"
                    />
                </div>
             </div>

             {/* Pricing */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                     <Label htmlFor="price">售價 (HK$)</Label>
                     <Input 
                        id="price" 
                        type="number" 
                        value={product.price} 
                        onChange={e => handleChange('price', e.target.value)}
                        className="font-bold text-[#C4A59D]"
                     />
                 </div>
                 <div className="space-y-2">
                     <Label htmlFor="originalPrice">原價 (HK$)</Label>
                     <Input 
                        id="originalPrice" 
                        type="number" 
                        value={product.originalPrice || ''} 
                        onChange={e => handleChange('originalPrice', e.target.value)}
                        className="text-muted-foreground"
                     />
                 </div>
             </div>

             {/* Attributes */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                     <Label htmlFor="colors">顏色 (用逗號分隔)</Label>
                     <Input 
                        id="colors"
                        value={colorsInput}
                        onChange={e => handleColorsChange(e.target.value)}
                        placeholder="黑, 白, 紅"
                     />
                 </div>
                 <div className="space-y-2">
                     <Label htmlFor="sizes">尺碼 (用逗號分隔)</Label>
                     <Input 
                        id="sizes"
                        value={sizesInput}
                        onChange={e => handleSizesChange(e.target.value)}
                        placeholder="S, M, L, XL"
                     />
                 </div>
             </div>
             
             <div className="space-y-2">
                  <Label htmlFor="category">類別</Label>
                  <Input 
                      id="category"
                      value={product.category}
                      onChange={e => handleChange('category', e.target.value)}
                  />
             </div>

             {/* Description */}
             <div className="space-y-2">
                 <Label htmlFor="description">商品描述</Label>
                 <Textarea 
                    id="description"
                    value={product.description}
                    onChange={e => handleChange('description', e.target.value)}
                    rows={6}
                    className="resize-none"
                 />
             </div>

             {/* Deadline */}
             <div className="space-y-3 pt-4 border-t">
                 <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">截單時間</Label>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${product.deadline ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-100'}`}>
                        {product.deadline ? (() => {
                            const d = new Date(product.deadline);
                            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                        })() : "未設定"}
                    </span>
                 </div>
                 <div className="flex justify-center border rounded-lg p-4 bg-gray-50/50">
                    <Calendar
                        mode="single"
                        selected={product.deadline ? new Date(product.deadline) : undefined}
                        onSelect={(date) => {
                             // When picking a new date, we might want to default to end of day? 
                             // For now standard behavior (00:00 local -> ISO)
                             handleChange('deadline', date ? date.toISOString() : undefined)
                        }}
                        className="rounded-md border bg-white shadow-sm"
                    />
                 </div>
             </div>
          </div>

          {/* Action Bar */}
          <div className="p-6 bg-gray-50 border-t mt-auto">
              <div className="flex flex-col gap-2">
                {message && (
                  <div className={`text-sm font-medium ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'} mb-2`}>
                    {message}
                  </div>
                )}
                <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white" 
                      onClick={handleSave}
                      disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {loading ? '儲存中...' : '儲存變更'}
                    </Button>
                </div>
              </div>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-0 bg-black/95 border-none overflow-hidden">
            <DialogTitle className="sr-only">Media Preview</DialogTitle>
            <div className="relative w-full h-full flex items-center justify-center">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 text-white hover:bg-white/20 z-50 rounded-full"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <X className="w-6 h-6" />
                </Button>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-40 rounded-full"
                    onClick={prevSlide}
                    disabled={mediaItems.length <= 1}
                >
                    <ChevronLeft className="w-8 h-8" />
                </Button>

                <div className="w-full h-full flex items-center justify-center p-4">
                    {mediaItems[currentSlide]?.type === 'video' ? (
                         (() => {
                           const embedUrl = getEmbedUrl(mediaItems[currentSlide]?.url);
                           if (embedUrl) {
                               return (
                                   <div className="w-full h-full flex items-center justify-center">
                                       <iframe 
                                            src={embedUrl}
                                            className="w-full max-w-[400px] h-full max-h-[80vh] border-0 rounded-lg shadow-2xl bg-black"
                                            allowFullScreen
                                            data-testid="video-embed-iframe"
                                            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                       />
                                   </div>
                               );
                           }
                           return (
                             <div className="text-white text-center flex flex-col items-center justify-center h-full">
                                 <Play className="w-20 h-20 mb-6 opacity-80" />
                                 <h3 className="text-xl font-medium mb-4">Video/Reels Video</h3>
                                 <p className="text-gray-400 mb-8 max-w-md mx-auto truncate px-4">{mediaItems[currentSlide]?.url}</p>
                                 <Button asChild className="bg-white text-black hover:bg-gray-200" size="lg">
                                     <a href={mediaItems[currentSlide]?.url} target="_blank" rel="noopener noreferrer">
                                         <Video className="w-4 h-4 mr-2"/> Watch Externally
                                     </a>
                                 </Button>
                             </div>
                           )
                         })()
                    ) : (
                        mediaItems[currentSlide]?.url && (
                             <div className="relative w-full h-full"> 
                                <Image 
                                    src={mediaItems[currentSlide].url} 
                                    alt="Detail view" 
                                    fill 
                                    className="object-contain"
                                    priority
                                />
                             </div>
                        )
                    )}
                </div>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-40 rounded-full"
                    onClick={nextSlide}
                    disabled={mediaItems.length <= 1}
                >
                    <ChevronRight className="w-8 h-8" />
                </Button>

                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                    {currentSlide + 1} / {mediaItems.length}
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
