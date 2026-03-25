"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type { SingleSkuDetails, SingleSkuVariation } from "@/lib/products"
// Replaced calendar with native datetime-local input for iPhone-style picker
import { 
  Dialog, 
  DialogContent, 
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Save, 
  X,
  Calendar,
  Video
} from "lucide-react"
import { Spinner } from '@/components/ui/spinner'
import NativeVideoPlayer from '@/components/native-video-player'

const todayLocal = (() => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
})()

// Removed embed URL parsing — use native player for direct URLs and
// provide an external link for third-party embeds.

// Local Product shape used by the editor (mapped from RPC when needed)
interface Product {
  id: string | number
  sku: string
  name: string
  price: number
  originalPrice?: number
  description?: string
  images: string[]
  colors: string[]
  sizes: string[]
  category?: string
  isNew?: boolean
  isSale?: boolean
  isUpsell?: boolean
  surcharge?: number | string
  reelsUrl?: string | null
  videoUrl?: string | null
  deadline?: string | Date | null
  totalQuota?: number
  date?: string | Date | null
  madeInKorea?: boolean
  rawRpc?: any
  [key: string]: any
}

interface SkuEditorProps {
  initialProduct: Product | SingleSkuDetails
}

function mapSingleSkuToProduct(rpc: SingleSkuDetails, fallback?: Product): Product {
  const images = (rpc.images || []).map(i => i.imageurl)
  const sizes = (rpc.variations || []).map(v => v.size).filter(Boolean) as string[]
  const colorsSet = new Set<string>()
  let totalQuota = 0
  ;(rpc.variations || []).forEach((v: SingleSkuVariation) => {
    (v.colors || []).forEach((c: any) => {
      if (c.color) colorsSet.add(c.color)
      if (typeof c.reels_quota === 'number') totalQuota += c.reels_quota
    })
  })

  const base: Product = fallback || {
    id: String(rpc.id),
    sku: rpc.SKU,
    name: rpc.remark || rpc.SKU,
    price: rpc.regular_price ?? 0,
    description: rpc.remark || '',
    images: images,
    colors: Array.from(colorsSet),
    sizes: sizes,
    category: rpc.type || '',
  }

  return {
    ...base,
    id: String(rpc.id),
    sku: rpc.SKU,
    name: rpc.remark || base.name || rpc.SKU,
    price: rpc.regular_price ?? base.price ?? 0,
    originalPrice: base.originalPrice,
    description: rpc.remark || base.description || '',
    images: images.length ? images : base.images || [],
    colors: Array.from(colorsSet).length ? Array.from(colorsSet) : base.colors || [],
    sizes: sizes.length ? sizes : base.sizes || [],
    category: rpc.type || base.category || '',
    isNew: base.isNew ?? false,
    // Prefer explicit RPC flag `is_discount_eligible`, fall back to legacy `special_discount`
    isSale: (rpc.is_discount_eligible ?? rpc.special_discount) ?? base.isSale ?? false,
    reelsUrl: rpc.reels_video_url || base.reelsUrl,
    videoUrl: rpc.reels_video_url || base.videoUrl,
    deadline: rpc.reels_deadline ?? base.deadline,
    totalQuota: totalQuota || base.totalQuota,
    date: rpc.SKU_date ? new Date(rpc.SKU_date) : base.date,
    madeInKorea: rpc.madeinkorea ?? base.madeInKorea,
    // Map shipping surcharge from RPC to show in the UI
    surcharge: (rpc.shipping_surcharge ?? (rpc.shippingSurcharge as any)) ?? base.surcharge,
    // Map upsell flag from RPC if present
    isUpsell: rpc.is_upsell_item ?? base.isUpsell ?? false,
    rawRpc: rpc as any,
  }
}

// Types for submit handler
interface SkuDetails {
  SKU: string;
  regular_price: number;
  remark?: string;
  delivery?: string;
  madeinkorea?: boolean;
  type?: string;
  reels_video_url?: string;
  is_reels_active?: boolean;
  reels_deadline?: string;
  shipping_surcharge?: number;
  is_discount_eligible?: boolean;
  is_upsell_item?: boolean;
  SKU_date?: string;
}

interface SkuVariation {
  id?: number;
  size: string;
  color: string;
  stock: number;
  hip?: string;
  waist?: string;
  length?: string;
  chest?: string;
  reels_quota?: number;
}

interface KeptImage {
  imageurl: string;
  imageIndex: number;
}

interface NewImageFile {
  file: File;
  imageIndex: number;
}


export async function submitSkuEdit(
  skuId: number,
  skuData: SkuDetails,
  variations: SkuVariation[],
  keptImages: KeptImage[],
  newImageFiles: NewImageFile[],
  newVideoFile?: File | null,
  originalSkuDetails?: any
): Promise<any> {
  const formData = new FormData()
  try {
    formData.append('sku_id', String(skuId))
    // include the sku details the Edge Function expects
    // Normalize sku details to include both possible DB column names so the Edge Function
    // can update either `reels_video_url` or `video_url` without failing.
    // Prefer `reels_video_url` and DO NOT include `video_url` to avoid DB column mismatch
    const normalizedSkuDetails = {
      ...skuData,
      reels_video_url: skuData.reels_video_url ?? (skuData as any).video_url ?? undefined,
    }
    formData.append('sku_details', JSON.stringify(normalizedSkuDetails))
    formData.append('variations', JSON.stringify(variations))
    formData.append('existing_images', JSON.stringify(keptImages))

    // include original sku_details so backend knows existing video_url
    if (originalSkuDetails) {
      // Include only `reels_video_url` in the original details to prevent updates to `video_url` column
      const orig = {
        ...originalSkuDetails,
        reels_video_url: originalSkuDetails.reels_video_url ?? originalSkuDetails.video_url ?? undefined,
      }
      formData.append('original_sku_details', JSON.stringify(orig))
    }

    // Append new image files using dynamic keys new_image_X
    for (const img of newImageFiles || []) {
      const key = `new_image_${img.imageIndex}`
      formData.append(key, img.file)
    }

    // If a new video file was selected, append it as 'video_file'
    if (newVideoFile) {
      formData.append('video_file', newVideoFile)
    }

    // Filter out any accidental `video_url` keys before sending (DB column is `reels_video_url`)
    const filteredFormData = new FormData()

    // Helper to recursively remove any `video_url` keys from objects
    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(sanitizeObject)
      const out: any = {}
      for (const k of Object.keys(obj)) {
        if (k === 'video_url') continue
        out[k] = sanitizeObject(obj[k])
      }
      return out
    }

    for (const [key, val] of Array.from(formData.entries())) {
      if (key === 'video_url') continue
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            const parsed = JSON.parse(trimmed)
            const sanitized = sanitizeObject(parsed)
            filteredFormData.append(key, JSON.stringify(sanitized))
            continue
          } catch (e) {
            // not JSON, fall through
          }
        }
      }
      filteredFormData.append(key, val as any)
    }

    // Debug: log final FormData keys (avoid printing file contents)
    try {
      console.log('submitSkuEdit final FormData keys:')
      for (const [key, val] of Array.from(filteredFormData.entries())) {
        if (val instanceof File) {
          console.log(key, { name: val.name, type: val.type, size: val.size })
        } else {
          const s = String(val)
          try { console.log(key, JSON.parse(s)) } catch { console.log(key, s) }
        }
      }
    } catch (e) {
      console.warn('Could not log final FormData payload', e)
    }

    // Call Supabase Edge Function via fetch so we can send FormData directly
    const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/edit-sku-with-images`

    // Debug: log the payload being sent (avoid printing raw file contents)
    try {
      console.log('Calling edge function', {
        fnUrl,
        sku_id: String(skuId),
        sku_details: normalizedSkuDetails,
        variations: variations,
        existing_images: keptImages,
        new_images: (newImageFiles || []).map(n => ({ imageIndex: n.imageIndex, name: n.file?.name, size: n.file?.size, type: n.file?.type })),
        video_file: newVideoFile ? { name: newVideoFile.name, size: newVideoFile.size, type: newVideoFile.type } : null,
      })
    } catch (e) {
      console.warn('Could not log edge function payload', e)
    }

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        // let browser set Content-Type for multipart/form-data
        Accept: 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
      },
      body: filteredFormData,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const err = new Error(`Edge function error: ${res.status} ${res.statusText} ${text}`)
      throw err
    }

    const body = await res.json().catch(() => ({}))
    return body
  } catch (err) {
    console.error('submitSkuEdit error', err)
    throw err
  }
}

export default function SkuEditor({ initialProduct }: SkuEditorProps) {
  const normalizedInitial: Product = ((): Product => {
    if (!initialProduct) return {
      id: '', sku: '', name: '', price: 0, images: [], colors: [], sizes: []
    }
    // If passed RPC object, map to Product
    if ((initialProduct as SingleSkuDetails).SKU) {
      return mapSingleSkuToProduct(initialProduct as SingleSkuDetails)
    }
    return initialProduct as Product
  })()

  const [product, setProduct] = useState<Product>(normalizedInitial)
  const imagesArr = product.images || []
  
  // Lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  
  const [isChanged, setIsChanged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [variationInputs, setVariationInputs] = useState<Record<string, string>>({})
  const [colorsInput, setColorsInput] = useState(initialProduct.colors?.join(', ') || '')
  const [sizesInput, setSizesInput] = useState(initialProduct.sizes?.join(', ') || '')
  const [colorDraft, setColorDraft] = useState('')
  const deadlineInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)
  // Track newly added image files (temp object URLs stored on product.images)
  const [newImageFilesState, setNewImageFilesState] = useState<Array<{ file: File; tempUrl: string }>>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Variation modal state
  const [isVariationDialogOpen, setIsVariationDialogOpen] = useState(false)
  const [localVariations, setLocalVariations] = useState<any[]>([])
  // Size detail dialog state
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
  const [activeSizeVariation, setActiveSizeVariation] = useState<any | null>(null)
  const [activeSizeName, setActiveSizeName] = useState<string | null>(null)
  // Confirm remove state for variations/colors
  const [confirmState, setConfirmState] = useState<{ open: boolean; type?: 'variation' | 'color'; vidx?: number; cidx?: number }>({ open: false })
  // Local flags for discount / upsell and surcharge
  const [isDiscount, setIsDiscount] = useState<boolean>(!!product.isSale)
  const [isUpsell, setIsUpsell] = useState<boolean>(!!product.isUpsell)
  const [surcharge, setSurcharge] = useState<string>(product.surcharge ? String(product.surcharge) : '')
  const router = useRouter()

  useEffect(() => {
    try { console.log('SkuEditor mounted', { id: product.id, name: product.name }) } catch (e) { /* ignore */ }
  }, [])

  // Clean up preview object URL when it changes or when component unmounts
  useEffect(() => {
    return () => {
      try {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
      } catch (e) {
        /* ignore */
      }
    }
  }, [previewUrl])

  const formatDatetimeLocal = (d?: string | Date | null) => {
    if (!d) return ''
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  // Format date for an <input type="date"> (YYYY-MM-DD)
  const formatDateLocal = (d?: string | Date | null) => {
    if (!d) return ''
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  // Handlers for basic input changes
  const handleChange = (field: keyof Product, value: any) => {
    setProduct(prev => ({ ...prev, [field]: value }))
    setIsChanged(true)
    setMessage(null)
  }

  // Handlers for array inputs (comma separated)
  const handleColorsChange = (value: string) => {
    // keep for backward-compat; not used in new chip UI
    const normalizedValue = value.replace(/，/g, ',')
    setColorsInput(normalizedValue)
    const array = normalizedValue.split(',').map(s => s.trim()).filter(Boolean)
    setProduct(prev => ({ ...prev, colors: array }))
    setIsChanged(true)
    setMessage(null)
  }

  const handleAddColor = () => {
    const color = (colorDraft || '').trim()
    if (!color) return
    setProduct(prev => ({ ...prev, colors: Array.from(new Set([...(prev.colors || []), color])) }))
    setColorDraft('')
    setIsChanged(true)
    setMessage(null)
  }

  const handleRemoveColor = (index: number) => {
    setProduct(prev => ({ ...prev, colors: (prev.colors || []).filter((_, i) => i !== index) }))
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

  const handleVariationInputChange = (size: string, value: string) => {
    setVariationInputs(prev => ({ ...prev, [size]: value }))
    setIsChanged(true)
    setMessage(null)
  }

  const openVariationDialog = () => {
    // initialize local copy from existing RPC variations (deep copy)
    const existing = product.rawRpc?.variations || []
    try {
      setLocalVariations(JSON.parse(JSON.stringify(existing)))
    } catch (e) {
      setLocalVariations(existing.slice())
    }
    setIsVariationDialogOpen(true)
  }

  const closeVariationDialog = () => {
    setIsVariationDialogOpen(false)
  }

  const addVariation = () => {
    setLocalVariations(prev => ([...prev, { size: '', colors: [] }]))
  }

  const removeVariation = (idx: number) => {
    setLocalVariations(prev => prev.filter((_, i) => i !== idx))
  }

  const requestRemoveVariation = (idx: number) => {
    setConfirmState({ open: true, type: 'variation', vidx: idx })
  }

  const updateVariationField = (idx: number, field: string, value: any) => {
    setLocalVariations(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  const addColorToVariation = (vidx: number) => {
    setLocalVariations(prev => prev.map((v, i) => i === vidx ? { ...v, colors: [...(v.colors || []), { color: '', stock: 0, reels_quota: 0 }] } : v))
  }

  const removeColorFromVariation = (vidx: number, cidx: number) => {
    setLocalVariations(prev => prev.map((v, i) => i === vidx ? { ...v, colors: (v.colors || []).filter((_: any, j: number) => j !== cidx) } : v))
  }

  const requestRemoveColor = (vidx: number, cidx: number) => {
    setConfirmState({ open: true, type: 'color', vidx, cidx })
  }

  const cancelConfirm = () => setConfirmState({ open: false })

  const confirmRemoval = () => {
    if (!confirmState.open) return
    if (confirmState.type === 'variation' && typeof confirmState.vidx === 'number') {
      removeVariation(confirmState.vidx)
    }
    if (confirmState.type === 'color' && typeof confirmState.vidx === 'number' && typeof confirmState.cidx === 'number') {
      removeColorFromVariation(confirmState.vidx, confirmState.cidx)
    }
    setConfirmState({ open: false })
    setIsChanged(true)
    setMessage('已刪除')
  }

  const updateColorField = (vidx: number, cidx: number, field: string, value: any) => {
    setLocalVariations(prev => prev.map((v, i) => {
      if (i !== vidx) return v
      const nextColors = (v.colors || []).map((c: any, j: number) => j === cidx ? { ...c, [field]: value } : c)
      return { ...v, colors: nextColors }
    }))
  }

  const saveVariations = () => {
    // Build sizes and colors aggregates from localVariations so the table updates immediately
    const sizes = (localVariations || []).map((v: any) => v.size).filter(Boolean)
    const colorsSet = new Set<string>()
    let totalQuota = 0
    ;(localVariations || []).forEach((v: any) => {
      (v.colors || []).forEach((c: any) => {
        if (c.color) colorsSet.add(c.color)
        if (typeof c.reels_quota === 'number') totalQuota += c.reels_quota
      })
    })

    setProduct(prev => ({
      ...prev,
      rawRpc: { ...(prev.rawRpc || {}), variations: localVariations },
      sizes: sizes.length ? sizes : prev.sizes,
      colors: Array.from(colorsSet).length ? Array.from(colorsSet) : prev.colors,
      totalQuota: totalQuota || prev.totalQuota,
    }))

    setIsChanged(true)
    setIsVariationDialogOpen(false)
    setMessage('已更新變體（本地）')
  }

  // Open native date picker when requested
  const openDeadlinePicker = () => {
    // Temporarily make the input visible so native picker can be opened reliably,
    // then focus/showPicker (or click) and hide the input again.
    try {
      setPickerVisible(true)
      setTimeout(() => {
        const el: any = deadlineInputRef.current
        if (!el) return
        if (typeof el.showPicker === 'function') {
          try { el.showPicker() } catch (e) { el.focus?.() }
          return
        }
        el.focus?.()
        try { el.click?.() } catch (e) { /* ignore */ }
      }, 50)
      // Do not auto-hide here — keep visible until user selects or blurs.
    } catch (e) {
      // ignore
    }
  }

  // Sync product state when toggles change
  const toggleDiscount = (v: boolean) => {
    setIsDiscount(v)
    setProduct(prev => ({ ...prev, isSale: v }))
    setIsChanged(true)
  }

  const toggleUpsell = (v: boolean) => {
    setIsUpsell(v)
    setProduct(prev => ({ ...prev, isUpsell: v }))
    setIsChanged(true)
  }

  const toggleMadeInKorea = (v: boolean) => {
    setProduct(prev => ({ ...prev, madeInKorea: v }))
    setIsChanged(true)
  }

  const handleSurchargeChange = (v: string) => {
    setSurcharge(v)
    setProduct(prev => ({ ...prev, surcharge: v }))
    setIsChanged(true)
  }

  // Image handlers
  const handleAddImage = () => {
    imageInputRef.current?.click()
  }

  const handleFilesSelected = (e: any) => {
    const files: File[] = Array.from(e.target.files || [])
    if (!files.length) return
    const urls = files.map(f => URL.createObjectURL(f))
    setProduct(prev => ({ ...prev, images: [...(prev.images || []), ...urls] }))
    setNewImageFilesState(prev => ([...prev, ...files.map((f, i) => ({ file: f, tempUrl: urls[i] }))]))
    setIsChanged(true)
    setMessage(null)
    // reset input so same file can be selected again
    e.target.value = ''
  }

  const handleVideoFilesSelected = (e: any) => {
    const files: File[] = Array.from(e.target.files || [])
    if (!files.length) return
    const file = files[0]
    const url = URL.createObjectURL(file)
    // set preview and show it in UI by temporarily assigning to product.videoUrl
    setPreviewUrl(url)
    setVideoFile(file)
    setProduct(prev => ({ ...prev, videoUrl: url }))
    setIsChanged(true)
    setMessage(null)
    e.target.value = ''
  }

  const handleRemoveImage = (index: number) => {
    const urlToRemove = product.images[index]
    setProduct(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))

    // If the removed image was one of the newly added files, remove it from newImageFilesState
    setNewImageFilesState(prev => prev.filter(n => n.tempUrl !== urlToRemove))

    if (currentSlide >= index && currentSlide > 0) {
      setCurrentSlide(c => c - 1)
    }
    setIsChanged(true)
    setMessage(null)
  }
  
  // Media items for lightbox (prefer DB-hosted video URLs, then reelsUrl, then images)
  const mediaItems = [
    ...(product.videoUrl ? [{ type: 'video', url: product.videoUrl }] : []),
    ...(product.reelsUrl && product.reelsUrl !== product.videoUrl ? [{ type: 'video', url: product.reelsUrl }] : []),
    ...imagesArr.map(url => ({ type: 'image', url }))
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
    try { console.log('handleSave invoked', { id: product.id, name: product.name, images: (product.images || []).length, newImages: newImageFilesState.length }) } catch (e) { /* ignore */ }
    setLoading(true)
    setMessage(null)
    try {
      // Build sku details payload
      const skuData: SkuDetails = {
        SKU: String(product.name),
        regular_price: Number(product.price),
        remark: product.description || undefined,
        delivery: undefined,
        madeinkorea: !!product.madeInKorea,
        type: product.category || undefined,
        reels_video_url: product.reelsUrl || undefined,
        is_reels_active: !!product.reelsUrl,
        reels_deadline: product.deadline ? new Date(product.deadline).toISOString() : undefined,
        // Ensure shipping_surcharge is an integer (DB expects integer)
        shipping_surcharge: surcharge ? Math.trunc(Number(surcharge)) : undefined,
        is_discount_eligible: isDiscount,
        is_upsell_item: isUpsell,
        SKU_date: product.date ? (product.date instanceof Date ? product.date.toISOString().slice(0,10) : String(product.date)) : undefined,
      }

      // Prepare variations: prefer localVariations when present, otherwise fallback to rawRpc.
      // Ensure that sizes with no colors still send a default color so the size is persisted.
      const variationsSource: any[] = (localVariations && localVariations.length) ? localVariations : (product.rawRpc?.variations || [])
      const variationsToSend: SkuVariation[] = variationsSource.flatMap(v => {
        const colorList = (v.colors && v.colors.length > 0)
          ? v.colors
          : [{ color: '單色', stock: 0, reels_quota: 0 }]

        return colorList.map((c: any) => ({
          id: c.id,
          size: v.size || 'One Size',
          color: c.color || '單色',
          stock: Number(c.stock || 0),
          reels_quota: Number(c.reels_quota || 0),
          hip: v.hip || '',
          waist: v.waist || '',
          length: v.length || '',
          chest: v.chest || '',
        }))
      })

      // Existing images to keep (exclude newly added temp URLs)
      const tempUrls = newImageFilesState.map(n => n.tempUrl)
      const keptImages: KeptImage[] = (product.images || []).map((url, idx) => ({ imageurl: url, imageIndex: idx })).filter(i => !tempUrls.includes(i.imageurl))

      // New image files with correct imageIndex determined by current product.images ordering
      const newImagesForSend: NewImageFile[] = newImageFilesState.map(n => ({ file: n.file, imageIndex: (product.images || []).indexOf(n.tempUrl) }))

      // Build FormData as required by the edge function
      const skuId = Number(product.id)
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/edit-sku-with-images`

      // Send payload to edge function
      try {
        const returned = await submitSkuEdit(
          skuId,
          skuData,
          variationsToSend,
          keptImages,
          newImagesForSend,
          videoFile instanceof File ? videoFile : null,
          normalizedInitial.rawRpc
        )

        // Revoke object URLs for uploaded files and preview
        newImageFilesState.forEach((n: any) => {
          try { URL.revokeObjectURL(n.tempUrl) } catch (e) { /* ignore */ }
        })
        try { if (typeof previewUrl === 'string') URL.revokeObjectURL(previewUrl) } catch (e) { /* ignore */ }
        setNewImageFilesState([])
        setVideoFile(null)
        setPreviewUrl(null)

        setMessage('更新成功')
        setIsChanged(false)
        if (returned?.sku_id && returned.sku_id !== skuId) setProduct(prev => ({ ...prev, id: returned.sku_id }))
        if (returned?.video_url || returned?.reels_video_url) {
          const newUrl = returned.video_url || returned.reels_video_url
          setProduct(prev => ({ ...prev, videoUrl: newUrl, reelsUrl: newUrl }))
        }
        try { router.push('/admin/skus') } catch (e) { /* ignore */ }
        setLoading(false)
        return
      } catch (err: any) {
        setMessage(err?.message || '更新失敗')
      }

    } catch (err: any) {
      setMessage(err?.message || '更新失敗')
    } finally {
      setLoading(false)
    }
  }

    

  // Return a proxied URL for external video hosts so the browser can range-request and avoid CORS issues
  const proxyVideoUrl = (url?: string | null | undefined) => {
    if (!url) return undefined
    try {
      // If already proxied, return as-is
      if (url.startsWith('/api/proxy-video')) return url
      // Only proxy http/https URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return `/api/proxy-video?url=${encodeURIComponent(url)}`
      }
    } catch (e) {
      // fall back to original url
    }
    return url
  }

  return (
    <div className="bg-white overflow-visible">
      <div className="grid grid-cols-1 md:grid-cols-2 md:items-start">
        <div className="flex flex-col h-full bg-white">
          <div className="p-6 space-y-6">
             
             {/* Header Info */}
             <div className="space-y-4 border-b pb-6">
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">商品名稱</Label>
                <Input 
                  id="name" 
                  value={product.name} 
                  onChange={e => handleChange('name', e.target.value)}
                  className="text-xs font-medium"
                />
              </div>
             </div>

             {/* Pricing + Category (surcharge moved to checkbox row) */}
             <div className="flex gap-4">
               <div className="space-y-2">
                 <Label htmlFor="price" className="text-xs">售價 (HK$)</Label>
                 <Input 
                  id="price" 
                  type="number" 
                  value={product.price} 
                  onChange={e => handleChange('price', e.target.value)}
                  className="block w-full rounded-md border-gray-200 p-2 bg-white text-xs"
                 />
                 
               </div>
               <div className="space-y-2">
                 <Label htmlFor="surcharge" className="text-xs">重件附加運費</Label>
                 <Input
                   id="surcharge"
                   type="text"
                   value={surcharge}
                   onChange={e => handleSurchargeChange(e.target.value)}
                   placeholder="0"
                   className="block rounded-md border-gray-200 p-2 bg-white w-24 text-xs"
                 />
               </div>

              

              
             </div>

             {/* Discount / Upsell checkboxes */}
             <div className="flex items-center gap-6 mt-3">

               <div className="space-y-2">
                 <Label htmlFor="category" className="text-xs">類別</Label>
                 <select
                   id="category"
                   value={product.category || ''}
                   onChange={e => handleChange('category', e.target.value)}
                   className="text-xs block w-full rounded-md border-gray-200 p-2 bg-white"
                 >
                   <option value="">請選擇類型</option>
                   <option>上身</option>
                   <option>下身</option>
                   <option>套裝</option>
                   <option>鞋</option>
                   <option>飾物</option>
                   <option>手袋</option>
                   <option>其他</option>
                 </select>
               </div>
               <label className="flex flex-col items-start gap-2">
                 <span className="text-xs">加購優惠</span>
                 <Checkbox checked={isDiscount} onCheckedChange={(v) => toggleDiscount(Boolean(v))} />
                 
               </label>

               <label className="flex flex-col items-start gap-2">
                <span className="text-xs">推薦加購商品</span>
                 <Checkbox checked={isUpsell} onCheckedChange={(v) => toggleUpsell(Boolean(v))} />
                
               </label>

               <label className="flex flex-col items-start gap-2">
                <span className="text-xs">韓國制</span>
                 <Checkbox checked={Boolean(product.madeInKorea)} onCheckedChange={(v) => toggleMadeInKorea(Boolean(v))} />
               </label>

               
             </div>

             
             {/* Deadline */}
             <div className="space-y-3 pt-4 border-t">
                 <div className="flex flex-col items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                           <Calendar className="w-4 h-4" />
                      <Label className="text-xs mb-2">截單時間</Label>
                      
                    </div>
                    <div className="flex gap-4">
                    <span className="text-sm ">
                        {product.deadline ? (() => {
                            const d = new Date(product.deadline);
                            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                        })() : "未設定"}
                    </span>
                    
                    <div className="relative">
                      <button type="button" onClick={openDeadlinePicker} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800">
                        更改期限
                      </button>
                      {/* Input is positioned over the button (invisible) when opening, so no extra visible field appears */}
                      <input
                        ref={deadlineInputRef}
                        type="date"
                        min={todayLocal}
                        value={formatDateLocal(product.deadline)}
                        onChange={(e) => {
                          const v = e.target.value
                          // If user selects a date, set deadline to that date at 23:59 local time
                          handleChange('deadline', v ? new Date(`${v}T23:59:00`).toISOString() : undefined)
                          // hide the helper input once a selection is made
                          setPickerVisible(false)
                        }}
                        onBlur={() => setPickerVisible(false)}
                        // Overlay the button but force text to be invisible so no date appears
                        style={pickerVisible ? { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', color: 'transparent', background: 'transparent', border: 'none', fontSize: 0, WebkitAppearance: 'none' } : { position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                        aria-hidden={pickerVisible ? 'false' : 'true'}
                      />
                    </div>
                   
                    </div>
                 </div>
                      
             </div>
            

             {/* Sizes / Colors / Stock / Reels Quota Table */}
             <div className="mt-4">
               
               <div className="overflow-x-auto mt-2">
                 <table className="w-full text-sm table-auto border-collapse">
                   <thead>
                     <tr className="text-left text-xs text-gray-500">
                       <th className="p-2">尺碼</th>
                       <th className="p-2"></th>
                       <th className="p-2">顏色</th>
                       <th className="p-2">庫存</th>
                       <th className="p-2">預定配額</th>
                    
                     </tr>
                   </thead>
                   <tbody>
                     {(product.sizes || []).map((size) => {
                        const variations = product.rawRpc?.variations || [];
                        const varItem = variations.find((v: any) => v.size === size) || null;
                        const colorsArr: any[] = (varItem?.colors && varItem.colors.length) ? varItem.colors : (product.colors || []).map((c: string) => ({ color: c }))

                        if (!colorsArr || colorsArr.length === 0) {
                          return (
                            <tr key={size} className="border-t">
                              <td className="p-2 align-top">{size}</td>
                              <td className="p-2 align-top">-</td>
                              <td className="p-2 align-top">-</td>
                              <td className="p-2 align-top">-</td>
                              <td className="p-2 align-top">-</td>
                            </tr>
                          )
                        }

                        return colorsArr.map((c: any, i: number) => {
                          const stock = (typeof c.stock === 'number') ? c.stock : (c.stock ? Number(c.stock) : '-')
                          const quota = (typeof c.reels_quota === 'number') ? c.reels_quota : (c.reels_quota ? Number(c.reels_quota) : '-')
                          return (
                            <tr key={`${size}-${c.color || i}`} className="border-t">
                              {i === 0 && (
                                <>
                                  <td rowSpan={colorsArr.length} className="p-2 align-top">{size}</td>
                                  <td rowSpan={colorsArr.length} className="p-2 align-top">
                                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setActiveSizeVariation(varItem); setActiveSizeName(size); setSizeDialogOpen(true) }}>尺碼詳情</Button>
                                  </td>
                                </>
                              )}
                              <td className="p-2">
                                <div className="flex flex-wrap gap-2">
                                  <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs">
                                    {c.color || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2 align-top">{stock}</td>
                              <td className="p-2 align-top">{quota}</td>
                            </tr>
                          )
                        })
                     })}
                     {(!product.sizes || product.sizes.length === 0) && (
                       <tr>
                         <td colSpan={4} className="p-3 text-sm text-gray-500">未有尺碼資料</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
              <div className="mt-6 flex justify-center">
                <Button variant="ghost" className="text-xs border-0 shadow-none" size="sm" onClick={openVariationDialog}>新增/更改變體</Button>
              </div>
             </div>

             {/* Media Section (moved below variation table) */}
             <div className="mt-6 border-t pt-6">
               {/* Video input */}
               <div className="space-y-2">
                 <Label className="text-sm font-medium flex items-center gap-2">
                   <Video className="w-4 h-4" /> 影片
                 </Label>
                 {/* Video link is now managed by the backend; input removed. */}
                  {((product.videoUrl) || (product.reelsUrl) || previewUrl) && (
                    (() => {
                      const source = previewUrl || product.videoUrl || product.reelsUrl
                      const containerClasses = "w-36 sm:w-44 md:w-56"
                      const videoSrc: string | undefined = previewUrl ?? (source ? (proxyVideoUrl(source) || source) : undefined)
                      return (
                        <div className="mt-3 max-h-72 overflow-hidden flex flex-col gap-4 items-center justify-center">
                          <div className={`${containerClasses} rounded-md overflow-hidden shadow-sm`}>
                            <video src={videoSrc} controls playsInline className="w-full h-full object-cover" />
                          </div>
                          <div className="ml-3 flex flex-col gap-2">
                            <Button size="sm" variant="outline" onClick={() => videoInputRef.current?.click()}>更換影片</Button>
                            {videoFile && (
                              <div className="text-xs text-gray-500">已選擇: {videoFile.name}</div>
                            )}
                          </div>
                        </div>
                      )
                    })()
                  )}
               </div>

               <div className="my-4 border-t" />

               {/* Images: add button + horizontal scroll row of 1:1 thumbnails */}
               <div className="flex items-center gap-4">
                 <div className="flex-1 min-w-0 overflow-x-auto">
                   <div className="flex space-x-3 py-2">
                     <div className="flex-shrink-0 w-24 h-24">
                       <Button onClick={handleAddImage} variant="outline" size="sm" className="w-full h-full flex items-center justify-center">
                         <Plus className="w-4 h-4 mr-2" /> 新增圖片
                       </Button>
                     </div>

                     {/* Hidden file input to allow choosing images from device */}
                     <input
                       ref={imageInputRef}
                       type="file"
                       accept="image/*"
                       multiple
                       onChange={handleFilesSelected}
                       style={{ display: 'none' }}
                       aria-hidden="true"
                     />
                     {/* Hidden file input to allow choosing video replacements */}
                     <input
                       ref={videoInputRef}
                       type="file"
                       accept="video/*"
                       onChange={handleVideoFilesSelected}
                       style={{ display: 'none' }}
                       aria-hidden="true"
                     />

                     {imagesArr.length === 0 && (
                       <div className="text-sm text-gray-500 px-2">尚無圖片</div>
                     )}
                     {imagesArr.map((img, idx) => {
                       const mediaIndex = (product.reelsUrl ? 1 : 0) + idx;
                       return (
                         <div key={idx} className="relative w-24 h-24 flex-shrink-0 bg-gray-50 rounded-md overflow-hidden group">
                           <Image src={img} alt={`Image ${idx + 1}`} fill className="object-cover" />
                           <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }} className="absolute top-1 right-1 bg-white/90 text-red-600 hover:bg-red-600 hover:text-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10">
                             <X className="w-3 h-3" />
                           </button>
                         </div>
                       )
                     })}
                   </div>
                 </div>
               </div>
             </div>

             

             
          </div>
          
          {/* Action Bar */}
          <div className="p-6 bg-gray-50  mt-auto sticky bottom-0 z-40">
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
                        {loading ? <Spinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        {loading ? '儲存中...' : '儲存變更'}
                    </Button>
                </div>
              </div>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {/* Variation Editor Dialog */}
      <Dialog open={isVariationDialogOpen} onOpenChange={setIsVariationDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogTitle className="text-xs">變體編輯</DialogTitle>
          <div className="space-y-4 p-2 max-h-[60vh] overflow-y-auto">
            {localVariations.length === 0 && (
              <div className="text-sm text-gray-500">目前沒有變體。按下「新增變體」開始。</div>
            )}
            {localVariations.map((v, vi) => (
              <div key={vi} className="shadow rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs">尺碼</Label>
                    <Input value={v.size || ''} onChange={e => updateVariationField(vi, 'size', e.target.value)} className="text-sm w-36" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => requestRemoveVariation(vi)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
<div className="pt-3">
                    
                    <div className="flex gap-2 items-center">
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">胸圍</div>
                        <Input
                          value={String(v.chest ?? '')}
                          onChange={e => updateVariationField(vi, 'chest', Number(e.target.value))}
                          
                          type="number"
                          className="text-xs w-10"
                        />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">腰圍</div>
                        <Input
                          value={String(v.waist ?? '')}
                          onChange={e => updateVariationField(vi, 'waist', Number(e.target.value))}
                         
                          type="number"
                          className="text-xs w-10"
                        />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">長度</div>
                        <Input
                          value={String(v.length ?? '')}
                          onChange={e => updateVariationField(vi, 'length', Number(e.target.value))}
                         
                          type="number"
                          className="text-xs w-10"
                        />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">臀圍</div>
                        <Input
                          value={String(v.hip ?? '')}
                          onChange={e => updateVariationField(vi, 'hip', Number(e.target.value))}
                          
                          type="number"
                          className="text-xs w-10"
                        />
                      </div>
                    </div>
                  </div>
                <div className="mt-2 space-y-2">
                 
                  {(v.colors || []).map((c: any, ci: number) => (
                    <div key={ci} className="flex gap-2 items-center mb-2">
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">顏色</div>
                        <Input value={c.color || ''} onChange={e => updateColorField(vi, ci, 'color', e.target.value)} placeholder="顏色" className="text-xs w-20" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">庫存</div>
                        <Input value={String(c.stock ?? '')} onChange={e => updateColorField(vi, ci, 'stock', Number(e.target.value))} placeholder="庫存" type="number" className="text-xs w-20" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">配額</div>
                        <Input value={String(c.reels_quota ?? '')} onChange={e => updateColorField(vi, ci, 'reels_quota', Number(e.target.value))} placeholder="配額" type="number" className="text-xs w-20" />
                      </div>
                      
                    </div>
                  ))}
                  <div>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => addColorToVariation(vi)}>
                      <Plus className="w-4 h-4 mr-2" /> 新增顏色
                    </Button>
                  </div>
                  
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center">
              <Button size="sm" variant="ghost"  onClick={addVariation}><Plus className="w-4 h-4 mr-2 text-xs" />新增變體</Button>
              <div className="flex gap-2">
               
                <Button size="sm" onClick={saveVariations}><Save className="w-4 h-4 mr-2" />儲存</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Removal Dialog */}
      <Dialog open={confirmState.open} onOpenChange={(v) => { if (!v) setConfirmState({ open: false }) }}>
        <DialogContent className="max-w-sm w-[90vw]">
          <DialogTitle>確認刪除？</DialogTitle>
          <div className="py-2">
            <p className="text-sm text-gray-700 mb-4">所有相關記錄包括庫存、配額都會刪除且無法復原。</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelConfirm}>取消</Button>
              <Button size="sm" onClick={confirmRemoval} className="bg-red-600 hover:bg-red-700 text-white">刪除</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Size Details Dialog */}
      <Dialog open={sizeDialogOpen} onOpenChange={setSizeDialogOpen}>
        <DialogContent className="max-w-md w-[90vw]">
          <DialogTitle className="text-xs text-center">尺碼詳情</DialogTitle>
          <div className="py-2 space-y-3">
            <div className="text-sm text-gray-700 flex flex-wrap items-center gap-4">
              <div>尺寸: {activeSizeName || '-'}</div>
              <div>顏色: {(activeSizeVariation?.colors || []).map((c: any) => c.color).filter(Boolean).join(', ') || '-'}</div>
            </div>
            <div>
             
              <div className="space-y-2">
                {(activeSizeVariation?.colors || []).map((c: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                   
                    <div className="text-gray-500">庫存: {typeof c.stock === 'number' ? c.stock : (c.stock ? Number(c.stock) : '-')}</div>
                    <div className="text-gray-500">配額: {typeof c.reels_quota === 'number' ? c.reels_quota : (c.reels_quota ? Number(c.reels_quota) : '-')}</div>
                  </div>
                ))}
                {(!activeSizeVariation?.colors || activeSizeVariation.colors.length === 0) && (
                  <div className="text-sm text-gray-500">無顏色資料</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mt-9">
             
              <div>
                <div className="text-gray-600">胸圍</div>
                <div>{activeSizeVariation?.chest ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-600">腰圍</div>
                <div>{activeSizeVariation?.waist ?? '-'}</div>
              </div>
              <div>
                <div className="text-gray-600">長度</div>
                <div>{activeSizeVariation?.length ?? '-'}</div>
              </div>
               <div>
                <div className="text-gray-600">臀圍</div>
                <div>{activeSizeVariation?.hip ?? '-'}</div>
              </div>
            </div>

            

           
          </div>
        </DialogContent>
      </Dialog>

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
                             return (
                               <div className="w-full h-full flex items-center justify-center">
                                  <div className="w-full max-w-[800px] h-full max-h-[80vh] rounded-lg overflow-hidden">
                                    <NativeVideoPlayer url={proxyVideoUrl(mediaItems[currentSlide]?.url)} poster={product.images?.[0]} isActive={false} />
                                  </div>
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
