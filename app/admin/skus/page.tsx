"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getActiveReelsSkus } from "@/lib/orderService";
import type { ActiveReelsSkuItem, ActiveReelsSkusResponse } from "@/types/order";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Lucide from "lucide-react";
import Image from "next/image";
import { HeaderTabMenu } from '@/components/header-tab-menu';
import EmptyWidget from '@/components/EmptyWidget';
import PaginationControls from "@/components/ui/pagination-controls";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const ITEMS_PER_PAGE = 30;



const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "上身": Lucide.Shirt,
  "下身": Lucide.Flower,
  "套裝": Lucide.Package,
  "鞋": Lucide.Footprints,
  "飾物": Lucide.Gem,
  "手袋": Lucide.Backpack,
  "其他": Lucide.Ellipsis,
};



export default function AdminSkusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fixed SKU types (use same order/icons as upload page)
  const categories = useMemo(() => Object.keys(CATEGORY_ICONS), []);

  // Server-driven SKUs from RPC
  const [items, setItems] = useState<ActiveReelsSkuItem[]>([]);
  const [metadata, setMetadata] = useState<ActiveReelsSkusResponse['metadata'] | null>(null);
  const [loading, setLoading] = useState(false);

  const totalItems = metadata?.total_results ?? 0;
  const totalPages = metadata?.total_pages ?? 0;
  const currentItems = items;

  // Fetch items when page, filters, or search change
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res: ActiveReelsSkusResponse = await getActiveReelsSkus(currentPage, ITEMS_PER_PAGE, selectedCategory ?? 'all', searchTerm);
        setItems(res.data ?? []);
        setMetadata(res.metadata ?? null);
      } catch (err) {
        console.error('Failed to fetch active reels skus', err);
        setItems([]);
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentPage, selectedCategory, searchTerm]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory(null);
  };

  const formatReelsDeadline = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  };

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <HeaderTabMenu active="skus" />
        </div>
      </header>

      <main className="p-4 pt-8 md:p-6 max-w-6xl mx-auto space-y-6 pb-24">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 bg-gray-50/50">
             <div className="relative flex-1">
                <Lucide.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="搜尋 SKU 或名稱..."
                    className="pl-9 bg-white border-gray-200 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             
            
          </div>

          {/* Category Dropdown + Results */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Select value={selectedCategory ?? "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
                <SelectTrigger className="text-xs w-[160px] bg-white border-gray-200">
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Lucide.ShoppingBag className="w-4 h-4" /> 全部
                    </div>
                  </SelectItem>
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat] || Lucide.ShoppingBag;
                    return (
                      <SelectItem key={cat} value={cat}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {cat}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {(searchTerm || selectedCategory) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  <Lucide.X className="w-4 h-4 mr-1" /> 清除篩選
                </Button>
              )}
            </div>

            <div className="text-xs text-gray-500">
              共 {totalItems} 筆結果
            </div>
          </div>
        </div>

       

        {/* Product List - Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentItems.length === 0 ? (
            <EmptyWidget message="找不到符合的 SKU" className="col-span-full  rounded-lg" />
          ) : (
            currentItems.map((product) => (
              <Link
                key={product.id}
                href={`/admin/skus/${product.id}`}
                className="block"
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 h-24 p-2">
                  <div className="w-20 h-24 relative bg-gray-100 flex-shrink-0 rounded-md overflow-hidden border border-gray-100">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.SKU}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <EmptyWidget message="No Img" className="w-full h-full p-0 text-xs" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                {product.type}
                            </span>
                            {product.is_discount_eligible && (
                              <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded">特別折扣</span>
                            )}
                            {product.is_upsell_item && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">加購商品</span>
                            )}
                        </div>
                        <h3 className="font-semibold text-sm text-[#111827] w-[180px] sm:w-[200px]">
                          {product.SKU}
                        </h3>
                        <p className="text-sm font-medium text-[#111827]">
                          ${product.regular_price != null ? product.regular_price.toLocaleString() : '-'}
                        </p>
                        {product.reels_deadline && (
                          (new Date(product.reels_deadline).getTime() < Date.now()) ? (
                            <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">過期已落架</span>
                          ) : (
                            <p className="text-xs text-gray-500">落架時間: {formatReelsDeadline(product.reels_deadline)}</p>
                          )
                        )}
                      </div>
                      
                      
                    </div>
                  </div>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>

        {/* Pagination */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className="mt-8"
        />
      </main>
    </div>
  );
}
