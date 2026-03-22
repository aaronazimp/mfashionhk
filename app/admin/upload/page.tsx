"use client";

import React from "react";

import { useState, useRef } from "react";
import Link from "next/link";
import { HeaderTabMenu } from '@/components/header-tab-menu';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, Toaster } from "sonner";
// @ts-ignore
import * as Lucide from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import ImageFullscreen from '@/components/ImageFullscreen';
// Calendar UI will be handled via native date input when requested
import { supabase } from '@/lib/supabase';


export default function AdminDashboard() {
  
  const todayLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  })();
  const todayIso = new Date().toISOString().split("T")[0];

  const [newSku, setNewSku] = useState({
    sku: "",
    price: "",
    deadline: `${todayLocal}T23:59:00`,
    reelsFile: null as File | null,
    videoUrl: "",
    reelsPreviewUrl: null as string | null,
    images: [] as { file: File; url: string }[],
    variations: [] as {
      color: string;
      size: string;
      stock?: string;
      reserved?: string;
      measurements?: { chest?: string; waist?: string; length?: string; hip?: string };
    }[],
    includeRecommended: false,
    includeAddOn: false,
    extraShippingEnabled: false,
    extraShippingAmount: "",
    madeInKorea: false,
  });
  const [skuType, setSkuType] = useState("上身");
  const [variationColor, setVariationColor] = useState("");
  const [variationSize, setVariationSize] = useState("one size");
  const [variationStock, setVariationStock] = useState("1");
  const [variationReserved, setVariationReserved] = useState("");
  const [variationChest, setVariationChest] = useState("");
  const [variationWaist, setVariationWaist] = useState("");
  const [variationLength, setVariationLength] = useState("");
  const [variationHip, setVariationHip] = useState("");
  
  const [selectedVariation, setSelectedVariation] = useState<
    | {
        color: string;
        size: string;
        stock?: string;
        reserved?: string;
        measurements?: { chest?: string; waist?: string; length?: string; hip?: string };
      }
    | null
  >(null);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number | null>(null);
  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editColor, setEditColor] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editReserved, setEditReserved] = useState("");
  const [editChest, setEditChest] = useState("");
  const [editWaist, setEditWaist] = useState("");
  const [editLength, setEditLength] = useState("");
  const [editHip, setEditHip] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isLongPressDragging, setIsLongPressDragging] = useState(false);
  const [longPressDragIndex, setLongPressDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const formatDateYMD = (iso?: string) => {
    if (!iso) return "未選擇日期";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "未選擇日期";
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const selectedImage = selectedImageIndex !== null ? ((newSku as any).images || [])[selectedImageIndex] : null;

  const deadlineInputRef = useRef<HTMLInputElement | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const formatDateLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const openDeadlinePicker = () => {
    try {
      setPickerVisible(true);
      setTimeout(() => {
        const el: any = deadlineInputRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
          try { el.showPicker() } catch (e) { el.focus?.() }
          return;
        }
        el.focus?.();
        try { el.click?.() } catch (e) { /* ignore */ }
      }, 50);
    } catch (e) {
      // ignore
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setNewSku((prev) => ({ ...prev, images: [...(prev as any).images || [], ...arr] }));
    // clear input
    e.currentTarget.value = "";
  };

  const reelsFileInputRef = useRef<HTMLInputElement | null>(null);
  const handleReelsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files.length ? e.target.files[0] : null;
    setNewSku((prev) => {
      // revoke previous preview if any
      try { if ((prev as any).reelsPreviewUrl) URL.revokeObjectURL((prev as any).reelsPreviewUrl); } catch (e) { /* ignore */ }
      const preview = f ? URL.createObjectURL(f) : null;
      return { ...prev, reelsFile: f, reelsPreviewUrl: preview };
    });
    // clear value so same file can be re-selected if removed
    e.currentTarget.value = "";
  };

  const removeImage = (index: number) => {
    setNewSku((prev) => {
      const imgs = (prev as any).images || [];
      const removed = imgs[index];
      if (removed) URL.revokeObjectURL(removed.url);
      const next = imgs.filter((_: any, i: number) => i !== index);
      return { ...prev, images: next };
    });
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === undefined) return;
    setNewSku((prev) => {
      const imgs = [...((prev as any).images || [])];
      const [moved] = imgs.splice(from, 1);
      imgs.splice(index, 0, moved);
      return { ...prev, images: imgs };
    });
    dragIndexRef.current = null;
  };

  const onTouchStart = (e: React.TouchEvent, index: number) => {
    dragIndexRef.current = index;

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onceCancel = () => cancelLongPress();

    // If the user moves (scrolls) before the long-press threshold, cancel the timer.
    // Use passive/once so these listeners don't block scrolling and auto-remove.
    document.addEventListener("touchmove", onceCancel, { passive: true, once: true });
    document.addEventListener("pointermove", onceCancel, { passive: true, once: true });
    document.addEventListener("mousemove", onceCancel, { passive: true, once: true });

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressDragging(true);
      setLongPressDragIndex(index);
    }, 500);
  };

  const onTouchMove = (e: React.TouchEvent, index: number) => {
    if (!isLongPressDragging || dragIndexRef.current === null) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }
  };

  const onTouchEnd = (e: React.TouchEvent, index: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (!isLongPressDragging) {
      dragIndexRef.current = null;
      return;
    }

    const from = dragIndexRef.current;
    if (from === null || from === undefined || from === index) {
      setIsLongPressDragging(false);
      setLongPressDragIndex(null);
      dragIndexRef.current = null;
      return;
    }

    setNewSku((prev) => {
      const imgs = [...((prev as any).images || [])];
      const [moved] = imgs.splice(from, 1);
      imgs.splice(index, 0, moved);
      return { ...prev, images: imgs };
    });

    setIsLongPressDragging(false);
    setLongPressDragIndex(null);
    dragIndexRef.current = null;
  };

  // Types for submit helper
  interface SkuDetails {
    SKU: string;
    regular_price: number;
    remark?: string;
    delivery?: string;
    feature_video?: string;
    special_discount?: boolean;
    madeinkorea?: boolean;
    feature_product?: boolean;
    type?: string;
    video_caption?: string;
    video_content?: string;
    feature_hot_section?: boolean;
    reels_video_url?: string;
    is_reels_active?: boolean;
    reels_deadline?: string;
    shipping_surcharge?: number;
    is_discount_eligible?: boolean;
    is_upsell_item?: boolean;
    SKU_date?: string;
  }

  interface SkuVariation {
    size: string;
    color: string;
    stock: number;
    hip?: number;
    waist?: number;
    length?: number;
    chest?: number;
    reels_quota?: number;
  }

  // Submit helper that sends FormData (files + JSON parts) to Supabase Edge Function
  async function submitNewSku(skuData: SkuDetails, variations: SkuVariation[], imageFiles: File[], videoFile?: File | null) {
    try {
      const formData = new FormData();

      // Ensure strict numeric casting before stringifying for multipart upload
      const payloadSku = {
        ...skuData,
        regular_price: Number(skuData.regular_price),
        shipping_surcharge: skuData.shipping_surcharge !== undefined ? Number(skuData.shipping_surcharge) : undefined,
        is_upsell_item: Boolean(skuData.is_upsell_item),
        special_discount: Boolean(skuData.special_discount),
      } as SkuDetails;

      const payloadVariations = (variations || []).map((v) => ({
        ...v,
        stock: Number(v.stock || 0),
        reels_quota: v.reels_quota !== undefined ? Number(v.reels_quota) : undefined,
        hip: v.hip !== undefined ? Number(v.hip) : undefined,
        waist: v.waist !== undefined ? Number(v.waist) : undefined,
        length: v.length !== undefined ? Number(v.length) : undefined,
        chest: v.chest !== undefined ? Number(v.chest) : undefined,
      }));

      formData.append('sku_details', JSON.stringify(payloadSku));
      formData.append('variations', JSON.stringify(payloadVariations));

      imageFiles.forEach((file, idx) => {
        formData.append(`image_${idx}`, file);
      });

      if (videoFile) {
        // ensure the video is sent using the expected key
        formData.append('video_file', videoFile);
      }

      // If a reels/video file was provided, append it as `video_file` to match other upload helpers
      // (Edge function / server expects `video_file` for direct uploads)
      // The caller should pass the file via the optional fourth parameter.

      // Call the edit function directly via the Functions HTTP endpoint
      // Use the public supabase URL + anon key so this works from the browser
      const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-sku-with-images`;
      const resFetch = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          // Supabase expects the anon key in both Authorization and apikey for Functions
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        // let the browser set Content-Type for FormData
        body: formData,
      });

      if (!resFetch.ok) {
        const txt = await resFetch.text().catch(() => '');
        throw new Error(txt || `Edge function returned status ${resFetch.status}`);
      }

      // normalize to the shape the rest of this helper expects
      let parsed: any = null;
      const text = await resFetch.text().catch(() => '');
      try { parsed = text ? JSON.parse(text) : {}; } catch (e) { parsed = text; }
      const res = { data: parsed, status: resFetch.status } as any;

      if (res.error) {
        throw res.error;
      }

      // Some runtimes expose a status; if present, ensure it's 200
      // Otherwise rely on absence of `res.error` and returned data.
      if ((res as any).status && (res as any).status !== 200) {
        throw new Error('Edge function returned non-200 status');
      }

      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      return data?.sku_id ?? data?.skuId ?? data?.id ?? null;
    } catch (error) {
      console.error('submitNewSku error', error);
      throw error;
    }
  }

  const formRef = useRef<HTMLFormElement | null>(null);
  const submitForm = () => {
    if (formRef.current) {
      // prefer requestSubmit when available to trigger form validation
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof formRef.current.requestSubmit === "function") formRef.current.requestSubmit();
      else formRef.current.submit();
    }
  };

  const handleSkuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performSubmit();
  };

  // Extracted submit logic so it can be called both from form submit and the bottom button
  const performSubmit = async () => {
    // Basic form validation
    const errors: string[] = [];
    if (!newSku.sku || !newSku.sku.toString().trim()) {
      errors.push('請填寫貨號後綴');
    }
    if (!newSku.price || newSku.price.toString().trim() === '' || Number.isNaN(Number(newSku.price))) {
      errors.push('請輸入有效價格');
    } else if (Number(newSku.price) <= 0) {
      errors.push('價格需大於 0');
    }
    if (!skuType || !skuType.trim()) {
      errors.push('請選擇類型');
    }
    // Reels video file is required
    if (!(newSku as any).reelsFile) {
      errors.push('請提供 Reels 影片檔案');
    }
    if (!newSku.variations || newSku.variations.length === 0) {
      errors.push('請至少新增一個變體');
    } else {
      (newSku.variations || []).forEach((v: any, idx: number) => {
        if (!v.color || !v.color.toString().trim()) errors.push(`變體 ${idx + 1}：缺少顏色`);
        if (!v.size || !v.size.toString().trim()) errors.push(`變體 ${idx + 1}：缺少尺寸`);
        if (v.stock !== undefined && v.stock !== null && v.stock !== '' && Number.isNaN(Number(v.stock))) errors.push(`變體 ${idx + 1}：庫存非數字`);
      });
    }

    if (errors.length > 0) {
      toast.error('表單驗證失敗', { description: errors.join('； ') });
      return;
    }

    const todayPrefix = "R" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fullSku = `${todayPrefix}${newSku.sku}`;

    // Build SkuDetails payload from current page state
    const skuData: SkuDetails = {
      SKU: fullSku,
      regular_price: Number(newSku.price) || 0,
      special_discount: false,
      madeinkorea: (newSku as any).madeInKorea || false,
      feature_product: (newSku as any).includeRecommended || false,
      is_upsell_item: (newSku as any).includeAddOn || false,
      type: skuType,
      // Uploading file instead of providing a URL; backend will receive the file as `video_file`.
      reels_video_url: undefined,
      feature_video: (newSku as any).videoUrl || undefined,
      is_reels_active: true,
      reels_deadline: newSku.deadline,
      shipping_surcharge: (newSku as any).extraShippingEnabled ? Number((newSku as any).extraShippingAmount) || 0 : undefined,
      SKU_date: todayIso,
    };

    // Map variations
    const parseNumberOrUndefined = (val: any) => {
      if (val === undefined || val === null || val === "") return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    const variationsPayload: SkuVariation[] = (newSku.variations || []).map((v: any) => ({
      size: v.size,
      color: v.color,
      stock: parseNumberOrUndefined(v.stock) ?? 0,
      // map nested measurements to top-level numeric keys
      hip: parseNumberOrUndefined(v.measurements?.hip),
      waist: parseNumberOrUndefined(v.measurements?.waist),
      length: parseNumberOrUndefined(v.measurements?.length),
      chest: parseNumberOrUndefined(v.measurements?.chest),
      reels_quota: parseNumberOrUndefined(v.reserved),
    }));

    // Collect File[] from newSku.images
    const imageFiles: File[] = ((newSku as any).images || []).map((i: any) => i.file).filter(Boolean);

    try {
      const sku_id = await submitNewSku(skuData, variationsPayload, imageFiles, (newSku as any).reelsFile || null);
      toast.success('SKU 已成功上傳', {
        description: `SKU: ${fullSku} (${variationsPayload.length} 變體) - 類型: ${skuType}`,
      });

      // post-upload cleanup: revoke any created object URLs, clear file inputs and reset form state
      try {
        const imgs = (newSku as any).images || [];
        imgs.forEach((it: any) => {
          try { if (it && it.url) URL.revokeObjectURL(it.url); } catch (e) { /* ignore */ }
        });
      } catch (e) {
        // ignore
      }

      // revoke reels preview URL if one was generated
      try {
        const reelsPreview = (newSku as any).reelsPreviewUrl;
        if (reelsPreview) {
          try { URL.revokeObjectURL(reelsPreview); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }

      if (reelsFileInputRef.current) {
        try { reelsFileInputRef.current.value = ""; } catch (e) { /* ignore */ }
      }

      setSelectedImageIndex(null);

      // reset form state on success (ensure images cleared and reelsFile + preview null)
      setNewSku({ sku: "", price: "", deadline: `${todayIso}T23:59:00`, reelsFile: null, reelsPreviewUrl: null, videoUrl: "", images: [], variations: [], includeRecommended: false, includeAddOn: false, extraShippingEnabled: false, extraShippingAmount: "", madeInKorea: false });
      setSkuType("上身");
      setVariationColor("");
      setVariationSize("");

      console.log('Created SKU id:', sku_id);
    } catch (err: any) {
      console.error('Failed to create SKU', err);
      toast.error('上傳失敗', { description: err?.message || '發生錯誤' });
    }
  };

  const addVariation = () => {
    const color = variationColor.trim();
    const size = variationSize.trim();
    if (!color || !size) {
      toast.error("無法新增變體", {
        description: "請填入顏色和尺寸",
      });
      return;
    }
    const measurements = {
      chest: variationChest.trim(),
      waist: variationWaist.trim(),
      length: variationLength.trim(),
      hip: variationHip.trim(),
    };
    setNewSku((prev) => ({
      ...prev,
      variations: [...prev.variations, { color, size, stock: variationStock.trim(), reserved: variationReserved.trim(), measurements } as any],
    }));
    setVariationColor("");
    // Keep variationSize and measurements so user doesn't need to re-enter size details
    setVariationStock("1");
    setVariationReserved("");
    toast.success("變體已新增", {
      description: `${color} / ${size}`,
    });
  };

  const removeVariation = (index: number) => {
    setNewSku((prev) => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index),
    }));
  };

  const saveVariation = () => {
    if (!editColor.trim() || !editSize.trim()) {
      toast.error("無法保存變體", {
        description: "請填入顏色和尺寸",
      });
      return;
    }
    if (selectedVariationIndex !== null) {
      setNewSku((prev) => {
        const updated = [...prev.variations];
        updated[selectedVariationIndex] = {
          color: editColor.trim(),
          size: editSize.trim(),
          stock: editStock.trim(),
          reserved: editReserved.trim(),
          measurements: {
            chest: editChest.trim(),
            waist: editWaist.trim(),
            length: editLength.trim(),
            hip: editHip.trim(),
          },
        };
        return { ...prev, variations: updated };
      });
      toast.success("變體已更新", {
        description: `${editColor.trim()} / ${editSize.trim()}`,
      });
      setIsVariationModalOpen(false);
      setIsEditMode(false);
    }
  };

  

  return (
    <div>
      <div className="min-h-screen pt-8 bg-white text-[#111827]">
        <Toaster position="top-center" theme="light" />
        <ImageFullscreen
          src={selectedImage?.url ?? ''}
          alt={selectedImage?.file?.name ?? ''}
          open={!!selectedImage}
          onClose={() => setSelectedImageIndex(null)}
        />
        
        {/* header removed as requested */}

        <main className="p-4 md:p-6 space-y-6 pb-24 max-w-4xl mx-auto">
          <HeaderTabMenu active="upload" />

          {/* SKU Uploader */}
          <Card className="bg-white border-gray-200">
          
            <CardContent>
              <form ref={formRef} onSubmit={handleSkuSubmit} className="space-y-4">
               

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="skuSuffix" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">貨號</Label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-[#6B7280] rounded whitespace-nowrap">
                        {"R" + new Date().toISOString().slice(0,10).replace(/-/g,"")}
                      </span>
                      <Input
                        id="skuSuffix"
                        value={newSku.sku}
                        onChange={(e) => setNewSku({ ...newSku, sku: e.target.value })}
                        className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm w-full md:w-auto"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">價格 (HKD)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newSku.price}
                      onChange={(e) =>
                        setNewSku({ ...newSku, price: e.target.value })
                      }
                      className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm"
                    />
                  </div>
                </div>

                 {/* New toggles and surcharge checkbox placed above 貨號 section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(newSku as any).includeRecommended}
                          onChange={(e) => setNewSku((s: any) => ({ ...s, includeRecommended: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                          style={(newSku as any).includeRecommended ? { backgroundColor: '#C4A59D', borderColor: '#D1D5DB', backgroundImage: `url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='white' stroke-width='2' d='M2 9l3 3 9-9'/%3E%3C/svg%3E")`, backgroundSize: '70% 70%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}
                        />
                      <span className="text-sm">推薦加購商品</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(newSku as any).includeAddOn}
                          onChange={(e) => setNewSku((s: any) => ({ ...s, includeAddOn: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 "
                          style={(newSku as any).includeAddOn ? { backgroundColor: '#C4A59D', borderColor: '#D1D5DB', backgroundImage: `url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='white' stroke-width='2' d='M2 9l3 3 9-9'/%3E%3C/svg%3E")`, backgroundSize: '70% 70%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}
                        />
                      <span className="text-sm">加購優惠</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(newSku as any).madeInKorea}
                          onChange={(e) => setNewSku((s: any) => ({ ...s, madeInKorea: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                          style={(newSku as any).madeInKorea ? { backgroundColor: '#C4A59D', borderColor: '#464747', backgroundImage: `url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='white' stroke-width='2' d='M2 9l3 3 9-9'/%3E%3C/svg%3E")`, backgroundSize: '70% 70%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}
                        />
                      <span className="text-sm">韓國製</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(newSku as any).extraShippingEnabled}
                        onChange={(e) => setNewSku((s: any) => ({ ...s, extraShippingEnabled: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#6B7280]">重件附加運費</span>
                    </label>
                    {(newSku as any).extraShippingEnabled && (
                      <Input
                        type="number"
                        value={(newSku as any).extraShippingAmount}
                        onChange={(e) => setNewSku((s: any) => ({ ...s, extraShippingAmount: e.target.value }))}
                        className="w-36 text-sm"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">類型</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {[
                      { key: "上身", label: "上身", icon: Lucide.Shirt },
                      { key: "下身", label: "下身", icon: Lucide.Flower },
                      { key: "套裝", label: "套裝", icon: Lucide.Package },
                      { key: "鞋", label: "鞋", icon: Lucide.Footprints },
                      { key: "飾物", label: "飾物", icon: Lucide.Gem },
                      { key: "手袋", label: "手袋", icon: Lucide.Backpack },
                      { key: "其他", label: "其他", icon: Lucide.Ellipsis },
                    ].map((opt) => {
                      const Icon = opt.icon as any
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSkuType(opt.key)}
                          className={`flex flex-col items-center gap-1 px-3 py-2 rounded text-sm border transition-all w-20 ${
                              skuType === opt.key
                                ? "bg-[#C4A59D] text-white border-[#C4A59D]"
                                : "bg-white border-gray-200 text-[#111827] hover:bg-[#F9F7F6]"
                            }`}
                        >
                          <span className="inline-flex"><Icon className="w-6 h-6" /></span>
                          <span className="text-xs">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Variations builder (moved here under SKU 類型) */}
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 mt-3">
                    <Label className="text-xs md:text-sm text-[#111827] font-semibold">新增 變體（顏色 / 尺寸）</Label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="variantColor" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">顏色</Label>
                        <Input id="variantColor" value={variationColor} onChange={(e) => setVariationColor(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantSize" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">尺寸</Label>
                        <Input id="variantSize" value={variationSize} onChange={(e) => setVariationSize(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantReserved" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">預售配額</Label>
                        <Input id="variantReserved" value={variationReserved} onChange={(e) => setVariationReserved(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantStock" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">庫存</Label>
                        <Input id="variantStock" type="number" value={variationStock} onChange={(e) => setVariationStock(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-300">
                      <div className="space-y-2">
                        <Label htmlFor="variantChest" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">胸 (cm)</Label>
                        <Input id="variantChest" value={variationChest} onChange={(e) => setVariationChest(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantWaist" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">腰 (cm)</Label>
                        <Input id="variantWaist" value={variationWaist} onChange={(e) => setVariationWaist(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantLength" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">長 (cm)</Label>
                        <Input id="variantLength" value={variationLength} onChange={(e) => setVariationLength(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantHip" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Hip (cm)</Label>
                        <Input id="variantHip" value={variationHip} onChange={(e) => setVariationHip(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                    </div>

                    <Button type="button" onClick={addVariation} className="w-full bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white font-bold text-sm h-10 mt-3">
                      新增變體
                    </Button>

                    {newSku.variations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <p className="text-xs text-[#6B7280] mb-2">已新增變體 ({newSku.variations.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {newSku.variations.map((v, idx) => (
                            <div
                              key={`${v.color}-${v.size}-${idx}`}
                              className="inline-flex items-center gap-2 bg-white border border-[#C4A59D] px-3 py-2 rounded text-xs md:text-sm text-[#111827] hover:bg-[#C4A59D]/5 transition-colors group cursor-pointer"
                              onClick={() => {
                                setSelectedVariation(v as any);
                                setSelectedVariationIndex(idx);
                                setEditColor((v as any).color);
                                setEditSize((v as any).size);
                                setEditStock((v as any).stock || "");
                                setEditReserved((v as any).reserved || "");
                                setEditChest((v as any).measurements?.chest || "");
                                setEditWaist((v as any).measurements?.waist || "");
                                setEditLength((v as any).measurements?.length || "");
                                setEditHip((v as any).measurements?.hip || "");
                                setIsEditMode(false);
                                setIsVariationModalOpen(true);
                              }}
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{(v as any).color} / {(v as any).size}</span>
                                <span className="text-[11px] text-[#6B7280]">庫存: {(v as any).stock ?? '-'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const sel = selectedVariation;
                                  const removed = newSku.variations[idx];
                                  if (
                                    sel &&
                                    sel.color === (removed as any).color &&
                                    sel.size === (removed as any).size
                                  ) {
                                    setSelectedVariation(null);
                                    setIsVariationModalOpen(false);
                                  }
                                  removeVariation(idx);
                                }}
                                className="group-hover:opacity-100 opacity-60 transition-opacity"
                              >
                                <Lucide.Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">截單日期</Label>
                  <div className="space-y-2">
                    <div className="bg-white border border-gray-200 rounded p-2 w-full md:w-auto">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[#6B7280]">{newSku.deadline ? formatDateYMD(newSku.deadline) : '未設定'}</div>
                        <div className="relative">
                          <button type="button" onClick={openDeadlinePicker} className="text-xs text-gray-600 hover:text-gray-800">更改期限</button>
                          <input
                            ref={deadlineInputRef}
                            type="date"
                            min={todayLocal}
                            value={formatDateLocal(newSku.deadline)}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewSku((prev) => ({ ...prev, deadline: v ? `${v}T23:59:00` : '' }));
                              setPickerVisible(false);
                            }}
                            onBlur={() => setPickerVisible(false)}
                            style={pickerVisible ? { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', color: 'transparent', background: 'transparent', border: 'none', fontSize: 0, WebkitAppearance: 'none' } : { position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                            aria-hidden={pickerVisible ? 'false' : 'true'}
                          />
                        </div>
                      </div>
                    </div>
                   
                  </div>
                  <p className="text-[10px] text-[#6B7280]">時間固定為 23:59，只能選擇未來日期</p>

                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Reels 影片</Label>
                  <div className="flex items-center gap-3">
                    <input ref={reelsFileInputRef} type="file" accept="video/*" onChange={handleReelsFileChange} className="hidden" />
                    <button type="button" onClick={() => reelsFileInputRef.current?.click()} className="px-3 py-2 bg-[#F3F4F6] text-sm rounded">選擇影片檔案</button>
                    <div className="text-sm text-[#6B7280] truncate">
                      {(newSku as any).reelsFile ? (newSku as any).reelsFile.name : '尚未選擇檔案'}
                    </div>
                    {(newSku as any).reelsFile && (
                      <button type="button" onClick={() => setNewSku(prev => ({ ...prev, reelsFile: null }))} className="text-xs text-red-600">移除</button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6B7280]">上傳影片檔案（建議 MP4）</p>
                </div>
                

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center justify-between w-full">上傳圖片（如有）
                    <div className="text-right text-xs">可拖曳排序</div></Label>
                  <label className="flex items-center justify-center w-full px-4 py-6 md:py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#C4A59D]/50 hover:bg-[#C4A59D]/2 transition-colors">
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                    <span className="text-xs md:text-sm text-[#6B7280]">點擊上傳圖片</span>
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-3">
                    {((newSku as any).images || []).map((img: any, idx: number) => (
                      <div
                        key={img.url}
                        draggable
                        onDragStart={(e) => onDragStart(e, idx)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, idx)}
                        onTouchStart={(e) => onTouchStart(e, idx)}
                        onTouchMove={(e) => onTouchMove(e, idx)}
                        onTouchEnd={(e) => onTouchEnd(e, idx)}
                        onClick={() => !isLongPressDragging && setSelectedImageIndex(idx)}
                        className={`aspect-square bg-gray-100 rounded overflow-hidden relative border-2 group hover:shadow-md transition-all cursor-move select-none ${
                          longPressDragIndex === idx
                            ? "border-[#C4A59D] bg-[#C4A59D]/10 shadow-lg scale-105"
                            : "border-gray-200 hover:border-[#C4A59D]/50"
                        }`}
                      >
                        <img src={img.url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-1 right-1 md:top-0 md:right-0 bg-black/60 md:bg-black/0 md:group-hover:bg-black/40 md:opacity-0 md:group-hover:opacity-100 p-1 md:p-1.5 rounded transition-all hover:bg-black/80"
                        >
                          <Lucide.Trash2 className="w-4 h-4 md:w-3 md:h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="sr-only">Submit</button>
              </form>
            </CardContent>
          </Card>

          {/* Bottom sticky upload button */}
          <div className="fixed left-0 right-0 bottom-0 z-50 bg-white/90 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <Button onClick={() => void performSubmit()} className="w-full bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white font-bold h-12 text-base md:text-lg transition-all active:scale-95">
                上傳商品
              </Button>
            </div>
          </div>

          {/* Image Viewer Modal */}
            <ImageFullscreen
              src={selectedImage?.url ?? ''}
              alt={selectedImage?.file?.name ?? ''}
              open={!!selectedImage}
              onClose={() => setSelectedImageIndex(null)}
            />
          {/* Variation Details Modal */}
          <Dialog open={isVariationModalOpen} onOpenChange={setIsVariationModalOpen}>
            <DialogContent className="max-w-xs bg-white border border-gray-200 w-[90vw]">
              <DialogHeader className="pb-1">
                <DialogTitle className="text-base font-bold text-[#111827]">變體詳情</DialogTitle>
              </DialogHeader>
              {selectedVariation ? (
                <div className="space-y-2 py-2">
                  {/* Edit Mode */}
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="editColor" className="text-[#111827] text-xs">顏色</Label>
                        <Input id="editColor" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="editSize" className="text-[#111827] text-xs">尺寸</Label>
                        <Input id="editSize" value={editSize} onChange={(e) => setEditSize(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="editReserved" className="text-[#111827] text-xs">預定配額</Label>
                        <Input id="editReserved" value={editReserved} onChange={(e) => setEditReserved(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="editStock" className="text-[#111827] text-xs">庫存數量</Label>
                        <Input id="editStock" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm mt-1" />
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">尺寸測量 (cm)</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="editChest" className="text-[#111827] text-[10px]">胸圍</Label>
                            <Input id="editChest" value={editChest} onChange={(e) => setEditChest(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editWaist" className="text-[#111827] text-[10px]">腰圍</Label>
                            <Input id="editWaist" value={editWaist} onChange={(e) => setEditWaist(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editLength" className="text-[#111827] text-[10px]">衣長</Label>
                            <Input id="editLength" value={editLength} onChange={(e) => setEditLength(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editHip" className="text-[#111827] text-[10px]">臀圍</Label>
                            <Input id="editHip" value={editHip} onChange={(e) => setEditHip(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <Button onClick={saveVariation} className="flex-1 bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white h-9 text-xs font-semibold transition-all active:scale-95">保存</Button>
                        <Button onClick={() => setIsEditMode(false)} variant="ghost" className="flex-1 text-red-500 h-9 text-xs font-semibold transition-all active:scale-95">取消</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* View Mode */}
                      <div className="space-y-2">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">顏色</div>
                          <div className="text-base font-bold text-[#111827]">{selectedVariation.color}</div>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">尺寸</div>
                          <div className="text-base font-bold text-[#111827]">{selectedVariation.size}</div>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">預定配額</div>
                          <div className="text-base font-bold text-[#111827]">{selectedVariation.reserved ?? '0'}</div>
                        </div>

                        <div className="bg-[#C4A59D]/5 p-3 rounded-lg border border-[#C4A59D]/20">
                          <div className="text-xs font-semibold text-[#C4A59D] uppercase tracking-wider mb-1">庫存數量</div>
                          <div className="text-base font-bold text-[#111827]">{selectedVariation.stock ?? '0'} 件</div>
                        </div>
                      </div>

                      {/* Measurements Section */}
                      {(selectedVariation.measurements?.chest || selectedVariation.measurements?.waist || selectedVariation.measurements?.length || selectedVariation.measurements?.hip) && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">尺寸測量 (cm)</div>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedVariation.measurements?.chest && (
                              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-[#C4A59D]/30 hover:bg-[#C4A59D]/2 transition-colors">
                                <div className="text-[10px] font-semibold text-[#6B7280] uppercase">胸圍</div>
                                <div className="text-sm font-bold text-[#111827] mt-0.5">{selectedVariation.measurements.chest}</div>
                              </div>
                            )}
                            {selectedVariation.measurements?.waist && (
                              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-[#C4A59D]/30 hover:bg-[#C4A59D]/2 transition-colors">
                                <div className="text-[10px] font-semibold text-[#6B7280] uppercase">腰圍</div>
                                <div className="text-sm font-bold text-[#111827] mt-0.5">{selectedVariation.measurements.waist}</div>
                              </div>
                            )}
                            {selectedVariation.measurements?.length && (
                              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-[#C4A59D]/30 hover:bg-[#C4A59D]/2 transition-colors">
                                <div className="text-[10px] font-semibold text-[#6B7280] uppercase">衣長</div>
                                <div className="text-sm font-bold text-[#111827] mt-0.5">{selectedVariation.measurements.length}</div>
                              </div>
                            )}
                            {selectedVariation.measurements?.hip && (
                              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 hover:border-[#C4A59D]/30 hover:bg-[#C4A59D]/2 transition-colors">
                                <div className="text-[10px] font-semibold text-[#6B7280] uppercase">臀圍</div>
                                <div className="text-sm font-bold text-[#111827] mt-0.5">{selectedVariation.measurements.hip}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Mode Edit Button */}
                      <div className="pt-2 border-t border-gray-200">
                        <Button onClick={() => setIsEditMode(true)} className="w-full bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white h-9 text-xs font-semibold transition-all active:scale-95">編輯</Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#6B7280]">無變體資料</p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          
        </main>
      </div>
    </div>
  );
}
