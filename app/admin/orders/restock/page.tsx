"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import RestockSkuCard from "@/components/restock-sku-card";
import { Spinner } from '@/components/ui/spinner'
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from '@/components/ui/sheet'
import RestockSidebar from '@/components/restock-sidebar'
import { supabase } from '@/lib/supabase'
import * as Lucide from 'lucide-react'
import { HeaderTabMenu } from '@/components/header-tab-menu'
import PaginationControls from '@/components/ui/pagination-controls'

export default function RestockPage() {
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [skus, setSkus] = useState<Product[]>([]);
  const [restockCounts, setRestockCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("action_required");
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(50);
  const [restockMetadata, setRestockMetadata] = useState<any | null>(null);

  const mountedRef = useRef(true);

  const filterOptions = [
    { key: 'action_required', label: '需補貨' },
    { key: 'all', label: '顯示全部' },
  ];

  // Load/reload restock dashboard RPC
  const loadRestock = async () => {
    if (mountedRef.current) setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_restock_dashboard', {
        p_search_term: query || '',
        p_filter_type: filterType,
        p_page: page,
        p_per_page: perPage,
      });
      if (error) throw error;
      // Support both legacy array responses and the new { data: [], metadata: {} } shape
      const rows: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      const metadata = data && !Array.isArray(data) ? data.metadata ?? null : null;

      const mapped: Product[] = rows.map((row: any) => ({
        id: String(row.sku_id),
        sku: row.sku_code,
        name: row.sku_code || '',
        price: 0,
        description: '',
        images: [row.main_image || '/placeholder.svg'],
        colors: [],
        sizes: [],
        category: '',
      }));

      const counts: Record<string, number> = {};
      rows.forEach((row: any) => {
        counts[String(row.sku_id)] = row.total_sku_waitlist_count ?? 0;
      });

      if (mountedRef.current) {
        setSkus(mapped);
        setRestockCounts(counts);
        setRestockMetadata(metadata);
      }
    } catch (e) {
      if (mountedRef.current) {
        setSkus([]);
        setRestockCounts({});
        setRestockMetadata(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Fetch restock dashboard from Supabase function and map to Product shape
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false };
  }, []);

  // Re-load when filters, pagination or query change
  useEffect(() => {
    if (!mountedRef.current) return;
    loadRestock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterType, page, perPage]);

  // debug: confirm mount and env
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug('RestockPage mounted', { supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL });
    } catch (e) {}
  }, []);

  // Subscribe to realtime changes on `reels_order` and refresh on events
  useEffect(() => {
    let mounted = true;
    const channel = supabase.channel('reels_order_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels_orders' }, (payload) => {
        try {
          // eslint-disable-next-line no-console
          console.debug('reels_order realtime payload', payload);
        } catch (e) {}
        loadRestock();
      });

    (async () => {
      try {
        const res = await channel.subscribe();
        // eslint-disable-next-line no-console
        console.debug('reels_order subscribe result', res);
        if ((res as any)?.error) {
          // eslint-disable-next-line no-console
          console.error('reels_order subscribe error', (res as any).error);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('reels_order subscribe threw', err);
      }
    })();

    return () => {
      mounted = false;
      channel.unsubscribe().catch(() => {});
    };
  }, []);

  const filteredSkus = useMemo(() => {
    return skus.filter((p: Product) => {
      if (!query) return true;
      return p.sku.toLowerCase().includes(query.toLowerCase()) || p.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [query, skus]);

  return (
    <div className="p-6 overflow-x-hidden min-h-screen flex pt-14">
      <div className="max-w-[1000px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-4">
          <HeaderTabMenu active="orders" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <input
            placeholder="搜尋貨號..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs flex-1 min-w-0 border rounded-full py-2 px-4 bg-white shadow-sm focus:outline-none"
          />
          <Link href="/admin/orders">
            <Button className="h-6 w-24 whitespace-nowrap text-xs ">切換訂單管理頁</Button>
          </Link>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 mb-4">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setFilterType(opt.key); setPage(1); }}
              className={
                `px-2 py-1 rounded-full text-xs transition-colors ${filterType === opt.key ? 'bg-[#C4A59D] text-white' : 'bg-white border border-gray-200 text-gray-700'}`
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Results metadata (top) */}
        {restockMetadata && (
          <div className="mb-4 flex items-center justify-between text-[9px] text-gray-600">
            <div className="flex items-center gap-2">
              <Lucide.Eye className="w-4 h-4 text-gray-600" />
              <div>
                {restockMetadata.result_range ? (
                  <>現正顯示 {restockMetadata.result_range} 筆結果</>
                ) : null}
              </div>
            </div>
            <div>
              {typeof restockMetadata.total_results !== 'undefined' ? (
                <div className="text-[9px] text-gray-600">共 {restockMetadata.total_results} 筆結果</div>
              ) : null}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner className="w-8 h-8 text-primary" />
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-sm text-gray-500">
            暫無補貨項目。
          </div>
          ) : (
          <div className=" flex-1 min-h-0 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {filteredSkus.map((p: Product, idx: number) => {
              // Use the RPC-provided total_sku_waitlist_count (default to 0 if missing)
              const restockCount = restockCounts[p.id] ?? 0;
              return (
                <div key={p.id} className="h-full">
                  <RestockSkuCard
                    product={p}
                    restockCount={restockCount}
                    onOpen={(prod) => { setSelectedProduct(prod); setSidebarOpen(true); }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {/* (moved) pagination metadata and controls are rendered above results */}
        {/* Pagination controls (bottom) */}
        {restockMetadata && (
          <PaginationControls
            currentPage={restockMetadata.current_page ?? 1}
            totalPages={restockMetadata.total_pages ?? 1}
            onPageChange={(p) => setPage(p)}
            className="mt-auto flex items-center justify-center py-4"
          />
        )}

        {/* Sidebar sheet for restock details */}
        <Sheet open={sidebarOpen} onOpenChange={(open) => { setSidebarOpen(open); if (!open) loadRestock(); }}>
          <SheetContent side="left" className="w-full sm:w-[540px] flex flex-col h-full px-4 sm:px-6 bg-white">
            <RestockSidebar product={selectedProduct} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
