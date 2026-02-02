"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ProductCard } from "@/components/product-card";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { 
  Calendar as CalendarIcon,
  Shirt, 
  ShoppingBag, 
  Layers, 
  Gem,
  Package,
  Footprints,
  MoreHorizontal,
  X,
  Filter,
  Flower
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

// Helper to parse date from SKU
const getDateFromSku = (sku: string): Date | null => {
  const match = sku.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
};

const CATEGORY_GROUPS = [
  { label: "上身", icon: Shirt, keywords: ["上身"] },
  { label: "下身", icon: Flower, keywords: ["下身"] },
  { label: "套裝", icon: Package, keywords: ["套裝"] },
  { label: "鞋", icon: Footprints, keywords: ["鞋"] },
  { label: "飾物", icon: Gem, keywords: ["飾物"] },
  { label: "手袋", icon: ShoppingBag, keywords: ["手袋"] },
  { label: "其他", icon: MoreHorizontal, keywords: ["其他"] },
];

const DATE_FILTERS = [
  { label: "所有日期", value: "all" },
  { label: "今天", value: "today" },
  { label: "過去 7 天", value: "7days" },
  { label: "過去 30 天", value: "30days" },
  { label: "本月", value: "thisMonth" },
  { label: "上個月", value: "lastMonth" },
];

const ITEMS_PER_PAGE = 30;

// Force rebuild
export function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Persistence Refs
  const skipNextFetch = useRef(false);
  const restoreScrollY = useRef(0);
  const isRestoring = useRef(false);
  const stateRef = useRef({ products, totalCount, selectedCategories, dateFilter, currentPage, isLoading });
  stateRef.current = { products, totalCount, selectedCategories, dateFilter, currentPage, isLoading };

  // Restore State
  useEffect(() => {
    // Disable browser default scroll restoration to avoid conflicts
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const saved = sessionStorage.getItem('mfashion-grid-state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Clean up old state if needed or validate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoredProducts = data.products.map((p: any) => ({
          ...p,
          date: p.date ? new Date(p.date) : undefined
        }));
        
        // Check if we have valid products to render
        if (restoredProducts.length > 0) {
            setProducts(restoredProducts);
            setTotalCount(data.totalCount);
            setSelectedCategories(data.selectedCategories);
            setDateFilter(data.dateFilter);
            setCurrentPage(data.currentPage);
            setIsLoading(false);
            
            skipNextFetch.current = true;
            restoreScrollY.current = data.scrollY;
            isRestoring.current = true;
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
    
    // We intentionally do NOT reset scrollRestoration to 'auto' on unmount
    // to ensure the browser doesn't try to scroll for us when we return.
  }, []);

  // Handle Scroll Restoration
  useEffect(() => {
      if (isRestoring.current && !isLoading && products.length > 0) {
          const attemptScroll = (count = 0) => {
             // Max attempts
             if (count > 5) return;
             
             const bodyHeight = document.body.scrollHeight;
             // If the page is shorter than the target scroll, we might need to wait more
             if (bodyHeight < restoreScrollY.current) {
                setTimeout(() => attemptScroll(count + 1), 50);
                return;
             }
             
             window.scrollTo({
                  top: restoreScrollY.current,
                  behavior: "instant"
              });
              
              // Verify
              if (Math.abs(window.scrollY - restoreScrollY.current) > 10) {
                 setTimeout(() => attemptScroll(count + 1), 50);
              } else {
                 isRestoring.current = false;
              }
          };

          // Initial attempt
          setTimeout(() => attemptScroll(), 0);
      }
  }, [isLoading, products]);

  // Save State
  useEffect(() => {
    return () => {
      const current = stateRef.current;
      // Only save if we have data and aren't loading, to avoid overwriting with empty state
      if (!current.isLoading && current.products.length > 0) {
        sessionStorage.setItem('mfashion-grid-state', JSON.stringify({
          ...current,
          scrollY: window.scrollY
        }));
      }
    };
  }, []);

  useEffect(() => {
    if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
    }

    async function fetchProducts() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('SKU_details')
          .select(`
            *,
            SKU_images (
              imageurl,
              imageIndex
            )
          `, { count: 'exact' })
          .neq('is_reels_active', true);
          // Removed .eq('SKU_images.imageIndex', 0) to allow products without image-0 or no images to show

        // --- Category Filter ---
        if (selectedCategories.length > 0) {
          const isOtherSelected = selectedCategories.includes("其他");
          
          // These are the keywords defined in CATEGORY_GROUPS (excluding "Other")
          const allKnownKeywords = CATEGORY_GROUPS
              .filter(g => g.label !== "其他")
              .flatMap(g => g.keywords);
          
          const selectedKeywords = CATEGORY_GROUPS
              .filter(g => selectedCategories.includes(g.label) && g.label !== "其他")
              .flatMap(g => g.keywords);
          
          if (isOtherSelected && selectedKeywords.length === 0) {
              // Only "Other" selected: exclude all known keywords
              query = query.not('type', 'in', `(${allKnownKeywords.map(k => `"${k}"`).join(',')})`);
          } else if (!isOtherSelected && selectedKeywords.length > 0) {
              // Only specific categories selected
               query = query.in('type', selectedKeywords);
          } else if (isOtherSelected && selectedKeywords.length > 0) {
               // Mixed: "Other" OR specific categories
               // Syntax: type.in.(A,B),type.not.in.(C,D) inside .or()
               const inStr = `type.in.(${selectedKeywords.map(k => `"${k}"`).join(',')})`;
               const notInStr = `type.not.in.(${allKnownKeywords.map(k => `"${k}"`).join(',')})`;
               query = query.or(`${inStr},${notInStr}`);
          }
        }

        // --- Date Filter ---
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const toDateStr = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (dateFilter !== 'all') {
          switch (dateFilter) {
            case "today":
              query = query.eq('SKU_date', toDateStr(today));
              break;
            case "7days": {
              const sevenDaysAgo = new Date(today);
              sevenDaysAgo.setDate(today.getDate() - 7);
              query = query.gte('SKU_date', toDateStr(sevenDaysAgo));
              break;
            }
            case "30days": {
              const thirtyDaysAgo = new Date(today);
              thirtyDaysAgo.setDate(today.getDate() - 30);
              query = query.gte('SKU_date', toDateStr(thirtyDaysAgo));
              break;
            }
            case "thisMonth": {
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
              query = query
                .gte('SKU_date', toDateStr(startOfMonth))
                .lt('SKU_date', toDateStr(startOfNextMonth));
              break;
            }
            case "lastMonth": {
              const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              query = query
                .gte('SKU_date', toDateStr(startOfLastMonth))
                .lt('SKU_date', toDateStr(startOfThisMonth));
              break;
            }
          }
        } else {
             // Default to max 3 months ago
             const threeMonthsAgo = new Date(today);
             threeMonthsAgo.setMonth(today.getMonth() - 3);
             query = query.gte('SKU_date', toDateStr(threeMonthsAgo));
        }

        // --- Pagination & Sorting ---
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        
        query = query
          .order('SKU_date', { ascending: false })
          .order('SKU', { ascending: true })
          .range(from, to);

        const { data, count, error } = await query;

        if (error) {
          console.error('Error fetching products:', error);
          return;
        }

        if (count !== null) {
          setTotalCount(count);
        }

        if (data) {
          const mappedProducts: Product[] = data.map((item: any) => {
             // Find image with index 0, or fallback to the first available image
             const targetImage = item.SKU_images?.find((img: any) => img.imageIndex === 0) || item.SKU_images?.[0];

             return {
              id: item.id.toString(),
              sku: item.SKU || '',
              name: item.SKU || 'Unknown Product',
              price: item.regular_price || 0,
              description: item.remark || '',
              images: targetImage?.imageurl ? [targetImage.imageurl] : [],
              category: item.type || '其他',
              isSale: item.special_discount || false,
              // Map SKU_date if available
              date: item.SKU_date ? new Date(item.SKU_date) : undefined,
              madeInKorea: item.madeinkorea,
              // Required props from Product interface
              colors: [],  
              sizes: [],
            };
          });
          setProducts(mappedProducts);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [currentPage, selectedCategories, dateFilter]);

  // Reset page when filters change (except when page itself changes)
  // We handle this by not resetting in the fetch effect, but separately:
  // However, putting 'fetchProducts' in one effect that depends on all 3 variables 
  // means we need to be careful not to reset 'currentPage' inside that effect.
  // Instead, we use an effect that watches ONLY filters to reset page.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, dateFilter]);


  // Pagination logic (Server-side)
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  // On server-side pagination, 'products' ALREADY contains only the items for the current page.
  // So we just render 'products' directly. No slicing needed.

  const toggleCategory = (label: string) => {
      setSelectedCategories(prev => {
          if (prev.includes(label)) {
              return prev.filter(c => c !== label);
          } else {
              return [...prev, label];
          }
      });
  };

  const removeCategory = (label: string) => {
      setSelectedCategories(prev => prev.filter(c => c !== label));
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setDateFilter("all");
  };

  const activeFilterCount = selectedCategories.length + (dateFilter !== 'all' ? 1 : 0);

  const FilterContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn("space-y-6", isMobile ? "py-2" : "mb-10")}>
        <div>
          <h3 className="text-lg font-medium text-muted-foreground mb-3 px-1">類型</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {CATEGORY_GROUPS.map((group) => {
                  const Icon = group.icon;
                  const isSelected = selectedCategories.includes(group.label);
                  return (
                      <button
                          key={group.label}
                          onClick={() => toggleCategory(group.label)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-2 aspect-square rounded-lg border transition-all duration-200",
                            isSelected 
                              ? "bg-[#C4A59D] border-[#C4A59D] text-white shadow-sm scale-105" 
                              : "bg-white border-border text-foreground hover:border-[#C4A59D] hover:text-[#C4A59D]"
                          )}
                      >
                          <Icon className={cn("w-5 h-5", isSelected ? "text-white" : "text-current")} strokeWidth={1.5} />
                          <span className="text-xs font-medium">{group.label}</span>
                      </button>
                  );
              })}
          </div>
        </div>

        <div className={cn("flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t pt-4 px-1", isMobile && "flex-col items-stretch border-t-0 pt-2")}>
             <div className="flex gap-2 items-center">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px] bg-background border-input">
                        <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
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

                 {(selectedCategories.length > 0 || dateFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4 mr-1" /> 清除<span className="hidden sm:inline">篩選</span>
                    </Button>
                )}
             </div>
             
             {!isMobile && (
                <div className="text-sm text-muted-foreground">
                    共 {totalCount} 件商品
                </div>
             )}
        </div>
    </div>
  );

  return (
    <section id="products" className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Live 精選商品
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            探索我們精心挑選的時尚單品，每一件都經過嚴格品質把關
          </p>
        </div>

        {/* Desktop Filter */}
        <div className="hidden md:block">
            <FilterContent />
        </div>

        {/* Active Filters Pills */}
        {(selectedCategories.length > 0 || dateFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-sm font-medium text-muted-foreground mr-1">已選條件:</span>
                
                {selectedCategories.map((cat) => (
                    <div 
                        key={cat}
                        className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium bg-[#C4A59D]/10 text-[#C4A59D] border border-[#C4A59D]/20 shadow-sm"
                    >
                        {cat}
                        <button 
                            onClick={() => removeCategory(cat)}
                            className="bg-transparent hover:bg-[#C4A59D]/20 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span className="sr-only">移除 {cat}</span>
                        </button>
                    </div>
                ))}

                {dateFilter !== 'all' && (
                    <div className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-sm">
                        <CalendarIcon className="w-3.5 h-3.5 opacity-50" />
                        {DATE_FILTERS.find(f => f.value === dateFilter)?.label}
                        <button 
                            onClick={() => setDateFilter("all")}
                            className="bg-transparent hover:bg-zinc-200 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span className="sr-only">移除日期篩選</span>
                        </button>
                    </div>
                )}
                
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="text-xs h-8 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                    清除全部
                </Button>
            </div>
        )}

        {/* Mobile Filter Drawer */}
        <div className="md:hidden">
            <Drawer>
                <DrawerTrigger asChild>
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 shadow-2xl rounded-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Button size="lg" className="rounded-full bg-[#111827] text-white hover:bg-[#111827]/90 px-8 h-12 shadow-xl border border-white/10 gap-2">
                            <Filter className="w-4 h-4" />
                            <span className="font-medium">篩選</span>
                            {activeFilterCount > 0 && (
                                <span className="flex items-center justify-center bg-[#C4A59D] text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full ml-0.5">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-sm">
                        <DrawerHeader>
                            <DrawerTitle>篩選商品</DrawerTitle>
                            <DrawerDescription>選擇您想查看的商品類型</DrawerDescription>
                        </DrawerHeader>
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            <FilterContent isMobile />
                        </div>
                        <DrawerFooter>
                            <DrawerClose asChild>
                                <Button className="w-full h-12 text-base bg-[#C4A59D] hover:bg-[#C4A59D]/90">
                                    查看 {totalCount} 件商品
                                </Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {isLoading ? (
             <div className="col-span-full py-20 text-center">
                <Spinner className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">正在加載商品...</p>
             </div>
          ) : products.length === 0 ? (
             <div className="col-span-full py-20 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">沒有找到商品</h3>
                <p className="text-muted-foreground">試試調整篩選條件</p>
                <div className="mt-4">
                   <Button variant="outline" onClick={clearFilters} className="gap-2">
                        <X className="w-4 h-4" />
                        清除所有篩選
                    </Button>
                </div>
             </div>
          ) : (
            products.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-12">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(p => p - 1);
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {/* Logic to show pages with ellipsis if too many */}
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNumber = i + 1;
                  // Show first, last, current, and surrounding pages
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          isActive={pageNumber === currentPage}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(pageNumber);
                          }}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  
                  // Show ellipsis
                  if (
                    pageNumber === currentPage - 2 || 
                    pageNumber === currentPage + 2
                  ) {
                     return (
                        <PaginationItem key={pageNumber}>
                            <PaginationEllipsis />
                        </PaginationItem>
                     );
                  }

                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(p => p + 1);
                    }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </section>
  );
}
