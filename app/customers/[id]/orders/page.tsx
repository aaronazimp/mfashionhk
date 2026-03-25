"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import EmptyWidget from "../../../../components/EmptyWidget";
import OrderDetailsModal from "../../../../components/order-details-modal-history";
import { Spinner } from "../../../../components/ui/spinner";
import { ListStatusBg, ListStatusLabel } from "../../../../lib/orderStatus";
import { getCustomerAllOrderHistory } from "../../../../lib/orderService";

type Order = {
  id: string;
  group_id: string;
  created_at: string;
  order_numbers?: string[];
  transaction_id?: string | null;
  items_count: number;
  total_price: number;
  status: string;
};

const PAGE_SIZE = 12;

export default function CustomerOrdersPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const customerId = params?.id ?? "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReferenceId, setModalReferenceId] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
 

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);

    // Use RPC to fetch customer's history records and map to local `Order` shape.
    getCustomerAllOrderHistory(customerId, 1, 1000)
      .then((res) => {
        const list = Array.isArray(res?.history_records) ? res.history_records : [];
        const mapped: Order[] = list.map((r: any) => ({
          id: r.group_id ?? String(Math.random()),
          group_id: r.group_id,
          created_at: r.group_date,
          order_numbers: Array.isArray(r.order_numbers) ? r.order_numbers : [],
          transaction_id: Array.isArray(r.transaction_ids) && r.transaction_ids.length ? r.transaction_ids[0] : null,
          items_count: r.item_count ?? "-",
          // group_total already in the response
          total_price: r.group_total ?? "-",
          status: r.dominant_status ?? "",
        }));

        setOrders(mapped);
        setCustomerInfo(res?.customer_info ?? null);
        setLifetimeStats(res?.lifetime_stats ?? null);
      })
      .catch((e) => {
        console.error('getCustomerAllOrderHistory error', e);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      const inOrderNumbers = Array.isArray(o.order_numbers) && o.order_numbers.some(n => n.includes(q));
      return (
        inOrderNumbers ||
        (o.transaction_id || "").includes(q) ||
        (o.group_id || "").includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

 

  function fmtDate(iso?: string) {
    if (!iso) return "-";
    try {
      return new Intl.DateTimeFormat("zh-Hant", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="p-4 border-b flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md hover:bg-slate-100"
          aria-label="返回"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>返回</span>
        </button>
        
      </header>

      <main className="flex-1 flex flex-col overflow-hidden ">
        <div className="w-full max-w-[1200px] mx-auto flex-1 flex flex-col min-h-0">
        {/* Customer summary */}
        <section className="p-4 ">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-md font-semibold mb-2">顧客: {customerInfo?.customer_name ?? '客戶姓名'}</div>
              <div className="text-sm ">WhatsApp: {customerInfo?.whatsapp ?? '-'}</div>
              <div className="text-sm ">預設地址: {customerInfo?.default_address ?? '-'}</div>
            </div>

            <div className="flex gap-2">
              <div className="px-3 py-2 bg-slate-50 rounded-md text-sm">
                <div className="text-xs text-slate-500">訂單總數</div>
                <div className="font-medium">{lifetimeStats?.total_order_count ?? orders.length}</div>
              </div>
              <div className="px-3 py-2 bg-slate-50 rounded-md text-sm">
                <div className="text-xs text-slate-500">總消費</div>
                <div className="font-medium">${lifetimeStats?.total_spent}</div>
              </div>
              <div className="px-3 py-2 bg-slate-50 rounded-md text-sm">
                <div className="text-xs text-slate-500">已取消</div>
                <div className="font-medium">{lifetimeStats?.total_cancelled ?? orders.filter((o) => o.status === "cancelled").length}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="搜尋訂單/交易編號..."
                className="flex-1 min-w-0 max-w-[300px] px-3 py-2 border rounded-full text-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border rounded-xl text-xs"
              >
                <option value="">全部狀態</option>
                {Object.keys(ListStatusLabel).map((k) => (
                  <option key={k} value={k}>{ListStatusLabel[k]}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 text-right text-[10px] text-slate-500">顯示 {filtered.length} 筆結果</div>
          </div>
        </div>

        {/* Table area */}
        <div className="flex-1 overflow-auto p-4 pb-9 min-h-0">
          {loading ? (
            <div className="py-8 flex items-center justify-center"><Spinner className="h-8 w-8 text-slate-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="max-w-xl mx-auto mt-12">
              <EmptyWidget />
            </div>
            ) : (
            <div className="overflow-auto rounded-md min-h-0">
              <table className="min-w-full table-auto border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="text-center px-4 py-2 w-40 whitespace-nowrap text-xs">查看詳情</th>
                    <th className="text-left px-4 py-2 w-40 whitespace-nowrap text-xs">狀態</th>
                    <th className="text-left px-4 py-2 w-48 whitespace-nowrap text-xs">訂單編號</th>
                    <th className="text-left px-4 py-2 w-48 whitespace-nowrap text-xs">交易編號</th>
                    <th className="text-right px-4 py-2 w-32 whitespace-nowrap text-xs">總價</th>
                    <th className="text-right px-4 py-2 w-32 whitespace-nowrap text-xs">件數</th>
                    <th className="text-left px-4 py-2 w-48 whitespace-nowrap text-xs">訂單日期</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((o) => (
                    <tr key={o.id} className="border-t last:border-b border-slate-400/30">
                      <td className="px-4 py-3 text-center w-40 whitespace-nowrap">
                        <button aria-label="查看詳情" className="p-1 rounded-md bg-slate-100 hover:bg-slate-200" onClick={() => { setModalReferenceId(o.group_id); setModalOpen(true); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs w-40 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ListStatusBg[o.status] ?? "bg-slate-100"}`}>
                          {ListStatusLabel[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs w-48 whitespace-nowrap">
                        {o.order_numbers && o.order_numbers.length ? (
                          <div className="flex flex-col">
                            {o.order_numbers.map((n) => (
                              <span key={n} className="text-primary">{n}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs w-48 whitespace-nowrap">
                        <span className="text-primary">{o.group_id}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right w-32 whitespace-nowrap">{typeof o.total_price === 'number' && o.total_price >= 1 ? `$${o.total_price}` : (o.total_price ?? '-')}</td>
                      <td className="px-4 py-3 text-xs text-right w-32 whitespace-nowrap">{o.items_count}</td>
                      <td className="px-4 py-3 text-xs w-48 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer pagination */}
        {filtered.length > PAGE_SIZE && (
          <footer className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-slate-600">第 {page} / {totalPages} 頁</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>上一頁</button>
              <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一頁</button>
            </div>
          </footer>
        )}
        </div>
      </main>
      <OrderDetailsModal open={modalOpen} onOpenChange={(v) => setModalOpen(v)} customerId={customerId} referenceId={modalReferenceId} />
    </div>
  );
}
