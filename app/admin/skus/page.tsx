"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { products } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Edit, 
  Plus, 
  Search, 
  Calendar as CalendarIcon,
  Shirt, 
  Scissors, 
  ShoppingBag, 
  Layers, 
  Watch,
  X 
} from "lucide-react";
import Image from "next/image";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_PAGE = 30;

// Helper to parse date from SKU
const getDateFromSku = (sku: string): Date | null => {
  const match = sku.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "上衣": Shirt,
  "外套": Layers,
  "飾品": Watch,
  "褲裝": Scissors, 
  "裙裝": ShoppingBag, 
  "連衣裙": ShoppingBag, 
};

const DATE_FILTERS = [
  { label: "所有日期", value: "all" },
  { label: "今天", value: "today" },
  { label: "過去 7 天", value: "7days" },
  { label: "過去 30 天", value: "30days" },
  { label: "本月", value: "thisMonth" },
  { label: "上個月", value: "lastMonth" },
];

export default function AdminSkusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("all");

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      // Category
      const matchesCategory = selectedCategory ? p.category === selectedCategory : true;

      // Date
      let matchesDate = true;
      if (dateFilter !== "all") {
        const skuDate = getDateFromSku(p.sku);
        if (!skuDate) {
           matchesDate = false; 
        } else {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          switch (dateFilter) {
            case "today":
              matchesDate = skuDate.getTime() === today.getTime();
              break;
            case "7days": {
              const sevenDaysAgo = new Date(today);
              sevenDaysAgo.setDate(today.getDate() - 7);
              matchesDate = skuDate >= sevenDaysAgo;
              break;
            }
            case "30days": {
              const thirtyDaysAgo = new Date(today);
              thirtyDaysAgo.setDate(today.getDate() - 30);
              matchesDate = skuDate >= thirtyDaysAgo;
              break;
            }
            case "thisMonth":
              matchesDate = skuDate.getMonth() === today.getMonth() && skuDate.getFullYear() === today.getFullYear();
              break;
            case "lastMonth": {
              const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              matchesDate = skuDate >= lastMonth && skuDate < thisMonthStart;
              break;
            }
          }
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [searchTerm, selectedCategory, dateFilter]);

  // Calculate pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, dateFilter]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory(null);
    setDateFilter("all");
  };

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <nav className="inline-flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
            <Link href="/admin/orders" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">處理訂單</Link>
            <Link href="/admin/upload" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">上傳 SKU</Link>
            <Link href="/admin/skus" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm font-medium bg-[#C4A59D] text-white text-center md:text-left hover:bg-[#C4A59D]/90 transition-colors">管理 SKUs</Link>
            <Link href="/admin/best-sellers" className="flex-1 md:flex-initial px-2 md:px-4 py-2 md:py-2 rounded text-xs md:text-sm text-[#111827] text-center md:text-left hover:bg-white/50 transition-colors">熱賣 SKU</Link>
          </nav>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pb-24">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold whitespace-nowrap">管理產品</h1>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Link href="/admin/upload">
                <Button className="gap-2 shrink-0 bg-[#C4A59D] hover:bg-[#C4A59D]/90 text-white w-full md:w-auto">
                  <Plus className="w-4 h-4" />
                  <span>新增產品</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
             <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="搜尋 SKU 或名稱..."
                    className="pl-9 bg-white border-gray-200"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             
             <div className="flex gap-2 w-full md:w-auto">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[140px] bg-white border-gray-200 shrink-0">
                    <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="選擇日期" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTERS.map(filter => (
                        <SelectItem key={filter.value} value={filter.value}>
                            {filter.label}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
          </div>

          {/* Category Icons */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-100">
             <Button
                variant={selectedCategory === null ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={cn("gap-2 whitespace-nowrap", selectedCategory === null && "bg-[#C4A59D]/10 text-[#C4A59D] hover:bg-[#C4A59D]/20")}
             >
                <ShoppingBag className="w-4 h-4" />
                全部
             </Button>
             
             {categories.map(cat => {
                 const Icon = CATEGORY_ICONS[cat] || ShoppingBag;
                 return (
                    <Button
                        key={cat}
                        variant={selectedCategory === cat ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn("gap-2 whitespace-nowrap", selectedCategory === cat && "bg-[#C4A59D]/10 text-[#C4A59D] hover:bg-[#C4A59D]/20")}
                    >
                        <Icon className="w-4 h-4" />
                        {cat}
                    </Button>
                 );
             })}

             {(searchTerm || selectedCategory || dateFilter !== 'all') && (
                 <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-muted-foreground">
                    <X className="w-4 h-4 mr-1" /> 清除篩選
                 </Button>
             )}
          </div>
        </div>

        {/* Results Info */}
        <div className="text-sm text-gray-500">
          共 {totalItems} 筆結果
        </div>

        {/* Product List - Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentItems.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-gray-500">找不到符合的 SKU</p>
            </div>
          ) : (
            currentItems.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex h-full p-3 gap-3 items-center">
                  <div className="w-20 h-24 relative bg-gray-100 flex-shrink-0 rounded-md overflow-hidden border border-gray-100">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                        No Img
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                {product.category}
                            </span>
                            {product.isNew && <span className="text-xs text-[#C4A59D] font-bold">NEW</span>}
                        </div>
                        <h3 className="font-semibold text-base truncate text-[#111827] w-[180px] sm:w-[200px]">
                          {product.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {product.sku}
                        </p>
                        <p className="text-sm font-medium text-[#111827]">
                          HK${product.price.toLocaleString()}
                        </p>
                      </div>
                      
                      <Link href={`/admin/skus/${product.sku}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-gray-400 hover:text-[#111827]"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} 
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .map((page) => {
                      const isNearCurrent = Math.abs(page - currentPage) <= 1;
                      const isFirst = page === 1;
                      const isLast = page === totalPages;
                      
                      if (!isNearCurrent && !isFirst && !isLast) {
                          if (page === currentPage - 2 || page === currentPage + 2) {
                              return (
                                <PaginationItem key={page}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                              )
                          }
                          return null;
                      }

                      return (
                          <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                isActive={page === currentPage}
                                onClick={(e) => { e.preventDefault(); handlePageChange(page); }}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                          </PaginationItem>
                      )
                  })}

                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>
    </div>
  );
}
