"use client";

import React from "react";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, Toaster } from "sonner";
import { Plus, Trash2, X, Layers, Package, Footprints, Gem, Backpack, Ellipsis, Shirt, UtilityPole, Flower } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";


export default function AdminDashboard() {
  
  const todayIso = new Date().toISOString().split("T")[0];

  const [newSku, setNewSku] = useState({
    sku: "",
    price: "",
    deadline: `${todayIso}T23:59:00`,
    reelsUrl: "",
    videoUrl: "",
    variations: [] as {
      color: string;
      size: string;
      stock?: string;
      measurements?: { chest?: string; waist?: string; length?: string; hip?: string };
    }[],
  });
  const [skuType, setSkuType] = useState("上身");
  const [variationColor, setVariationColor] = useState("");
  const [variationSize, setVariationSize] = useState("one size");
  const [variationStock, setVariationStock] = useState("1");
  const [variationChest, setVariationChest] = useState("");
  const [variationWaist, setVariationWaist] = useState("");
  const [variationLength, setVariationLength] = useState("");
  const [variationHip, setVariationHip] = useState("");
  
  const [selectedVariation, setSelectedVariation] = useState<
    | {
        color: string;
        size: string;
        stock?: string;
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setNewSku((prev) => ({ ...prev, images: [...(prev as any).images || [], ...arr] }));
    // clear input
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

  const handleSkuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const todayPrefix = "R" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fullSku = `${todayPrefix}${newSku.sku}`;
    toast.success("SKU 已成功上傳", {
      description: `SKU: ${fullSku} (${newSku.variations.length} 變體) - 類型: ${skuType}`,
    });
    setNewSku({ sku: "", price: "", deadline: `${todayIso}T23:59:00`, reelsUrl: "", videoUrl: "", variations: [] });
    setSkuType("上身");
    setVariationColor("");
    setVariationSize("");
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
      variations: [...prev.variations, { color, size, stock: variationStock.trim(), measurements } as any],
    }));
    setVariationColor("");
    // Keep variationSize and measurements so user doesn't need to re-enter size details
    setVariationStock("1");
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
      <div className="min-h-screen bg-white text-[#111827]">
        <Toaster position="top-center" theme="light" />
        {selectedImageIndex !== null && (
          <>
            <div
              onClick={() => setSelectedImageIndex(null)}
              aria-hidden="true"
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200"
            />
            <button
              onClick={() => setSelectedImageIndex(null)}
              aria-label="Close image viewer"
              className="fixed p-3 rounded-full bg-black/70 hover:bg-black/80 transition-colors z-[9999] text-white shadow-lg"
              style={{ top: "calc(env(safe-area-inset-top, 1rem) + 0.5rem)", right: "calc(env(safe-area-inset-right, 1rem) + 0.5rem)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </>
        )}
        
        {/* header removed as requested */}

        <main className="p-4 md:p-6 space-y-6 pb-24 max-w-4xl mx-auto">
          <nav className="inline-flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
            <Link href="/admin/orders" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">處理訂單</Link>
            <Link href="/admin/upload" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm font-medium bg-[#C4A59D] text-white text-center md:text-left hover:bg-[#C4A59D]/90 transition-colors">上傳 SKU</Link>
            <Link href="/admin/skus" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">管理 SKUs</Link>
            <Link href="/admin/best-sellers" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">熱賣 SKU</Link>
          </nav>

          {/* SKU Uploader */}
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg text-[#111827] flex items-center gap-2">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                新增產品
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSkuSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="skuSuffix" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">貨號</Label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-[#6B7280] rounded whitespace-nowrap">
                        {"R" + new Date().toISOString().slice(0,10).replace(/-/g,"")}
                      </span>
                      <Input
                        id="skuSuffix"
                        placeholder="M01"
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
                      placeholder="888"
                      value={newSku.price}
                      onChange={(e) =>
                        setNewSku({ ...newSku, price: e.target.value })
                      }
                      className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">類型</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {[
                      { key: "上身", label: "上身", icon: Shirt },
                      { key: "下身", label: "下身", icon: Flower },
                      { key: "套裝", label: "套裝", icon: Package },
                      { key: "鞋", label: "鞋", icon: Footprints },
                      { key: "飾物", label: "飾物", icon: Gem },
                      { key: "手袋", label: "手袋", icon: Backpack },
                      { key: "其他", label: "其他", icon: Ellipsis },
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
                        <Input id="variantColor" placeholder="米白" value={variationColor} onChange={(e) => setVariationColor(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantSize" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">尺寸</Label>
                        <Input id="variantSize" placeholder="M" value={variationSize} onChange={(e) => setVariationSize(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantStock" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">庫存</Label>
                        <Input id="variantStock" placeholder="10" type="number" value={variationStock} onChange={(e) => setVariationStock(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-300">
                      <div className="space-y-2">
                        <Label htmlFor="variantChest" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">胸 (cm)</Label>
                        <Input id="variantChest" placeholder="胸圍" value={variationChest} onChange={(e) => setVariationChest(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantWaist" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">腰 (cm)</Label>
                        <Input id="variantWaist" placeholder="腰圍" value={variationWaist} onChange={(e) => setVariationWaist(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantLength" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">長 (cm)</Label>
                        <Input id="variantLength" placeholder="衣長" value={variationLength} onChange={(e) => setVariationLength(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variantHip" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Hip (cm)</Label>
                        <Input id="variantHip" placeholder="臀圍" value={variationHip} onChange={(e) => setVariationHip(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm" />
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
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
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
                      <Calendar
                        className="w-full md:max-w-md"
                        classNames={{ root: 'w-full md:max-w-md' }}
                        defaultMonth={currentMonthStart}
                        mode="single"
                        selected={newSku.deadline ? new Date(newSku.deadline.split('T')[0]) : undefined}
                        numberOfMonths={1}
                        disabled={{ before: new Date(new Date().toDateString()) }}
                        onSelect={(d: Date | undefined) => {
                          if (d) setNewSku((prev) => ({ ...prev, deadline: `${d.toISOString().split("T")[0]}T23:59:00` }));
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <div className="text-sm text-[#6B7280]">{formatDateYMD(newSku.deadline)}晚上11:59分</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6B7280]">時間固定為 23:59，只能選擇未來日期</p>

                </div>
                <div className="space-y-2">
                  <Label htmlFor="reelsUrl" className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Reels 連結</Label>
                  <Input
                    id="reelsUrl"
                    placeholder="https://www.facebook.com/reel/..."
                    value={newSku.reelsUrl}
                    onChange={(e) =>
                      setNewSku({ ...newSku, reelsUrl: e.target.value })
                    }
                    className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm truncate"
                  />
                </div>
                

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">上傳圖片（可拖曳排序）</Label>
                  <label className="flex items-center justify-center w-full px-4 py-6 md:py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#C4A59D]/50 hover:bg-[#C4A59D]/2 transition-colors">
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                    <span className="text-xs md:text-sm text-[#6B7280]">點擊上傳或拖曳圖片</span>
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
                          <Trash2 className="w-4 h-4 md:w-3 md:h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white font-bold h-12 text-base md:text-lg transition-all active:scale-95"
                >
                  上傳 SKU
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Image Viewer Modal */}
          <Dialog modal={false} open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
            <DialogContent showCloseButton={false} className="border-0 p-0 shadow-none bg-transparent max-w-none">
                  <DialogTitle className="sr-only">展開圖片</DialogTitle>
                  <DialogDescription className="sr-only">顯示已選擇的圖片檢視，按關閉返回</DialogDescription>
                  {/* close button intentionally rendered at top-level to avoid transformed ancestor affecting fixed positioning */}
                    <div className="fixed inset-0 bg-transparent pointer-events-auto px-4 py-8 [&_button]:hidden">
                      <div className="flex items-center justify-center h-full">
                        <div className="max-h-[90vh] max-w-[90vw] overflow-auto flex items-center justify-center" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
                          {selectedImageIndex !== null && ((newSku as any).images || [])[selectedImageIndex] && (
                            <img
                              src={((newSku as any).images || [])[selectedImageIndex].url}
                              alt="expanded"
                              className="max-h-[90vh] max-w-[90vw] object-contain"
                            />
                          )}
                        </div>
                      </div>
                  </div>
                </DialogContent>
          </Dialog>

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
                        <Label htmlFor="editStock" className="text-[#111827] text-xs">庫存數量</Label>
                        <Input id="editStock" value={editStock} onChange={(e) => setEditStock(e.target.value)} className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-sm mt-1" />
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">尺寸測量 (cm)</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="editChest" className="text-[#111827] text-[10px]">胸圍</Label>
                            <Input id="editChest" value={editChest} onChange={(e) => setEditChest(e.target.value)} placeholder="可選" className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editWaist" className="text-[#111827] text-[10px]">腰圍</Label>
                            <Input id="editWaist" value={editWaist} onChange={(e) => setEditWaist(e.target.value)} placeholder="可選" className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editLength" className="text-[#111827] text-[10px]">衣長</Label>
                            <Input id="editLength" value={editLength} onChange={(e) => setEditLength(e.target.value)} placeholder="可選" className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="editHip" className="text-[#111827] text-[10px]">臀圍</Label>
                            <Input id="editHip" value={editHip} onChange={(e) => setEditHip(e.target.value)} placeholder="可選" className="bg-white border-gray-200 text-[#111827] placeholder:text-[#6B7280] text-xs mt-1" />
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
