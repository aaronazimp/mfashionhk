"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation'
import * as Lucide from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { toast } from '@/hooks/use-toast';
import { getMasterOrderList } from '@/lib/orderService';
import { ListStatusLabel, ListStatusBg } from "@/lib/orderStatus";
import { HeaderTabMenu } from '@/components/header-tab-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import OrderDetailsModalAll from '@/components/order-details-modal-all';
import BatchConfirmModal from '@/components/batchProcess/BatchConfirmModal';
import BatchPackingModal from '@/components/batchProcess/BatchPackingModal';
import BatchPaymentReminderModal from '@/components/batchProcess/BatchPaymentReminderModal';
import BatchVerifiedModal from '@/components/batchProcess/BatchVerifiedModal';
import BatchShippingModal from '@/components/batchProcess/BatchShippingModal';
import BatchRestockReminderModal from '@/components/batchProcess/BatchRestockReminderModal';
import EmptyWidget from '@/components/EmptyWidget';
import { List, ListItem } from '@/components/ui/list';
// DebugPanel removed - debug logging cleaned

export default function OrdersPage() {
  const { loading: countLoading, meta: countMeta, statusCounts } = useFetchOrders('all', 1, 1, false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCustomerId, setModalCustomerId] = useState<string | null>(null);
  const [modalPriorityStatus, setModalPriorityStatus] = useState<string | null>(null);
  // Batch modal state lifted to top-level to avoid being affected by
  // CustomerList re-renders which caused flicker.
  const [batchModalOpenTop, setBatchModalOpenTop] = useState(false)
  const [batchModalSelectedOrderKeys, setBatchModalSelectedOrderKeys] = useState<string[]>([])
  const [batchModalCustomerIds, setBatchModalCustomerIds] = useState<string[]>([])
  const [batchModalStatusFilter, setBatchModalStatusFilter] = useState<string | 'all'>('all')
  const searchParams = useSearchParams()
  const router = useRouter()

  const [showSoundDialog, setShowSoundDialog] = useState(false);

  useEffect(() => {
    try {
      const interacted = typeof window !== 'undefined' ? localStorage.getItem('orders_audio_dialog_interacted') : null;
      if (!interacted) {
        setShowSoundDialog(true);
      }
    } catch (e) {}
  }, []);

  // If the user previously enabled audio, try to initialize the audio element
  useEffect(() => {
    try {
      const enabled = typeof window !== 'undefined' ? localStorage.getItem('orders_audio_enabled') : null;
      if (enabled) {
        try {
          const w: any = window as any;
          if (!w.__orders_alert_audio) {
            const a = new Audio('/audioefx.mp3');
            a.preload = 'auto';
            a.volume = 0.8;
            // attempt to play/pause to unlock on some browsers; if it fails still keep reference
            a.play().then(() => {
              try { a.pause(); a.currentTime = 0; } catch (e) {}
              w.__orders_alert_audio = a;
            }).catch((err) => {
              // play may fail without user gesture; still keep the element so future user gesture can unlock
              try { w.__orders_alert_audio = a; } catch (e) {}
            });
          }
        } catch (e) {
          console.warn('init orders audio failed', e);
        }
      }
    } catch (e) {}
  }, []);

  // Open batch modal when URL contains modal/status params (e.g. from OrderDetails navigation)
  useEffect(() => {
    const modal = searchParams?.get?.('modal')
    const status = searchParams?.get?.('status')
    if (!modal && !status) return

    // Prefer explicit `status` param, otherwise map modal -> status
    const resolvedStatus = status ?? (modal === 'batchConfirm' ? 'allocated' : modal === 'batchPaymentReminder' ? 'confirmed' : modal === 'batchVerified' ? 'paid' : modal === 'batchShipping' ? 'pending_to_ship' : null)
    if (!resolvedStatus) return

    const ordersParam = searchParams?.get('orders') || ''
    const customerParam = searchParams?.get('customer') || ''

    setBatchModalStatusFilter(resolvedStatus as any)
    setBatchModalSelectedOrderKeys(ordersParam ? ordersParam.split(',') : [])
    setBatchModalCustomerIds(customerParam ? [customerParam] : [])
    setBatchModalOpenTop(true)

    // remove modal params from URL to avoid re-triggering on navigation back/refresh
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('modal')
      url.searchParams.delete('status')
      url.searchParams.delete('orders')
      url.searchParams.delete('customer')
      router.replace(url.pathname + url.search)
    } catch (e) {}
  }, [searchParams?.toString()])

  // subscribe to realtime changes on `reels_orders` and trigger a refresh
  useEffect(() => {
    try {
      const w: any = window as any;
      // ensure fetcher list exists
      if (!w.__orders_fetchers) w.__orders_fetchers = [];

      // define a persistent payload handler on window so HMR/remounts reuse it
      if (!w.__orders_handlePayload) {
        w.__orders_handlePayload = (payload: any) => {
          try {
            const raw: any = payload || {};
            const rawType = (raw.type ?? raw.eventType ?? raw.event ?? '').toString();
            const normalized = {
              ...raw,
              eventType: raw.eventType ?? raw.type ?? raw.event,
              type: raw.type ?? raw.eventType ?? raw.event,
              event: raw.event ?? raw.type ?? raw.eventType,
              typeNormalized: rawType ? rawType.toUpperCase() : '',
            } as any;
            const immediate = (normalized.typeNormalized || '').toUpperCase() === 'INSERT';
            const detail = { ...normalized, immediate };

            try { window.dispatchEvent(new CustomEvent('orders:refresh', { detail })); } catch (e) {}

            const callFetchers = () => {
              try {
                const fns = (w.__orders_fetchers && Array.isArray(w.__orders_fetchers)) ? w.__orders_fetchers.filter((fn: any) => typeof fn === 'function') : [];
                if (fns.length) {
                  console.info('orders: invoking fetchers', fns.map((fn: any) => (fn && fn.__orders_fetcher_id) || (fn && fn.name) || String(fn).slice(0, 40)));
                  fns.forEach((fn: any) => {
                    try { fn(); } catch (e) { console.error('orders: fetcher error', (fn && fn.__orders_fetcher_id) || fn, e); }
                  });
                  return true;
                }
              } catch (e) { console.warn('orders: callFetchers failure', e); }
              return false;
            };

            let invokedNow = false;
            try { invokedNow = !!callFetchers(); } catch (e) { invokedNow = false; }
            if (!invokedNow) {
              let attempts = 0;
              const retry = () => {
                attempts++;
                if (callFetchers()) return;
                if (attempts < 5) setTimeout(retry, 200);
              };
              setTimeout(retry, 200);
            }

            try {
              const audioEnabled = typeof window !== 'undefined' ? !!localStorage.getItem('orders_audio_enabled') : false;
              w.__orders_last_refresh_info = {
                ts: Date.now(),
                immediate: !!immediate,
                typeNormalized: normalized.typeNormalized ?? null,
                fetchersCount: (w.__orders_fetchers && Array.isArray(w.__orders_fetchers)) ? w.__orders_fetchers.length : 0,
                fetchersInvokedImmediate: !!invokedNow,
                audioEnabled: audioEnabled,
                audioPresent: !!(w.__orders_alert_audio),
              };
            } catch (e) {
              try { w.__orders_last_refresh_info = null; } catch (ee) {}
            }

            if (immediate) {
              try {
                let a = w.__orders_alert_audio;
                try {
                  const enabled = typeof window !== 'undefined' ? localStorage.getItem('orders_audio_enabled') : null;
                  if (!a && enabled) {
                    a = new Audio('/audioefx.mp3');
                    a.preload = 'auto';
                    a.volume = 0.8;
                    // attempt to unlock by playing/pausing once
                    a.play().then(() => { try { a.pause(); a.currentTime = 0; } catch (e) {} }).catch(() => {});
                    w.__orders_alert_audio = a;
                  }
                } catch (e) {}

                if (a && typeof a.play === 'function') {
                  try { a.currentTime = 0; a.play().catch((err: any) => console.warn('audio play failed', err)); } catch (e) { console.warn('audio play error', e); }
                }
              } catch (e) {}
            }
          } catch (e) {
            try { window.dispatchEvent(new CustomEvent('orders:refresh', { detail: payload })); } catch (err) {}
          }
        };
      }

      // subscribe once per window session (persist across HMR)
      if (!w.__orders_supabase_subscribed) {
        try {
          const channel = supabase.channel('reels-order-listener');
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reels_orders' }, (payload: any) => {
            try { (window as any).__orders_handlePayload(payload); } catch (e) {}
          });
          channel.subscribe((status: string, err?: Error) => {
            if (status === 'SUBSCRIBED') {
              w.__orders_supabase_subscribed = true;
              w.__orders_supabase_channel = channel;
              console.info('orders: realtime subscribed');
              try {
                w.__orders_force_resubscribe = async () => {
                  try {
                    console.info('orders: force resubscribe triggered');
                    try {
                      if (w.__orders_supabase_channel && typeof w.__orders_supabase_channel.unsubscribe === 'function') {
                        try { await w.__orders_supabase_channel.unsubscribe(); } catch (e) { /* ignore */ }
                      }
                    } catch (e) {}
                    w.__orders_supabase_subscribed = false;
                    w.__orders_supabase_channel = null;
                    const ch = supabase.channel('reels-order-listener-' + Date.now());
                    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'reels_orders' }, (payload: any) => {
                      try { (window as any).__orders_handlePayload(payload); } catch (e) {}
                    });
                    ch.subscribe((s: string, e?: Error) => {
                      if (s === 'SUBSCRIBED') {
                        w.__orders_supabase_subscribed = true;
                        w.__orders_supabase_channel = ch;
                        console.info('orders: force resubscribe succeeded');
                      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
                        console.warn('orders: force resubscribe failed', s, e);
                      }
                    });
                  } catch (e) {
                    console.warn('orders: force resubscribe error', e);
                  }
                };
              } catch (e) {}
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('reels-order-listener subscribe error', status, err);
              w.__orders_supabase_subscribed = false;
            } else if (status === 'CLOSED') {
              w.__orders_supabase_subscribed = false;
            }
          });
        } catch (err) {
          console.error('reels-order-listener setup failed', err);
        }
      }

      // Robustness: if subscription isn't active, retry periodically (survives transient failures)
      try {
        if (!w.__orders_sub_retry_started) {
          w.__orders_sub_retry_started = true;
          let attempts = 0;
          const maxAttempts = 20;
          const retryInterval = 3000;
          const retryId = setInterval(async () => {
            try {
              attempts++;
              if (w.__orders_supabase_subscribed) {
                clearInterval(retryId);
                w.__orders_sub_retry_started = false;
                return;
              }
              if (attempts > maxAttempts) {
                clearInterval(retryId);
                w.__orders_sub_retry_started = false;
                console.warn('orders: giving up subscribing after max attempts');
                return;
              }

              // Try to (re)create the channel and subscribe
              try {
                if (!w.__orders_sub_retry_pending) {
                  w.__orders_sub_retry_pending = true;
                  const ch = supabase.channel('reels-order-listener-retry-' + Date.now());
                  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'reels_orders' }, (payload: any) => {
                    try { (window as any).__orders_handlePayload(payload); } catch (e) {}
                  });
                  ch.subscribe((s: string, e?: Error) => {
                    w.__orders_sub_retry_pending = false;
                    if (s === 'SUBSCRIBED') {
                      w.__orders_supabase_subscribed = true;
                      w.__orders_supabase_channel = ch;
                      clearInterval(retryId);
                      w.__orders_sub_retry_started = false;
                      console.info('orders: realtime subscribed on retry');
                    } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
                      console.warn('orders: retry subscribe failed', s, e);
                    }
                  });
                }
              } catch (e) {
                w.__orders_sub_retry_pending = false;
                // swallow and retry
              }
            } catch (e) {
              // ignore retry loop errors
            }
          }, retryInterval);
          // run immediate attempt
          (async () => {})();
        }
      } catch (e) {}

      // keep subscription global; no local cleanup (persist across HMR)
    } catch (err) {
      console.error('failed to setup reels_order subscription', err);
    }
  }, []);

  

  return (
    <div className="h-screen bg-white text-[#111827] overflow-auto flex flex-col p-4 pt-16 pb-28 w-full">
            <div className="mb-4">
              <HeaderTabMenu active="orders" />
            </div>

            <Dialog open={showSoundDialog} onOpenChange={(o) => { if (!o) setShowSoundDialog(false); }}>
              <DialogContent className="max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-sm">啟用聲音提示？</DialogTitle>
                  <DialogDescription className="text-xs text-gray-600">當有新訂單時，系統會播放短音效提示。此動作需要您的授權，點選「啟用」嘗試播放測試音效。</DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex justify-end gap-2 mt-4">
                  <Button className="text-xs" variant="outline" onClick={() => {
                    try {
                      try { localStorage.setItem('orders_audio_dialog_interacted', '1'); } catch (e) {}
                    } catch (e) {}
                    setShowSoundDialog(false);
                  }}>不，謝謝</Button>

                  <Button className="text-xs" onClick={async () => {
                    try {
                      try { localStorage.setItem('orders_audio_dialog_interacted', '1'); } catch (e) {}
                      const a = new Audio('/audioefx.mp3');
                      a.preload = 'auto';
                      a.volume = 0.8;
                      try {
                        await a.play();
                        (window as any).__orders_alert_audio = a;
                        try { localStorage.setItem('orders_audio_enabled', '1'); } catch (e) {}
                      } catch (playErr) {
                        console.warn('Audio play failed during enable', playErr);
                      }
                    } catch (e) {
                      console.error('enable audio failed', e);
                    } finally {
                      setShowSoundDialog(false);
                    }
                  }}>啟用</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

      <div className="mb-4">
        <div className="w-full mt-0">
          <div className="mx-auto w-full max-w-[1200px] flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-sm font-bold mb-2">目前有 {countMeta?.total_results ?? (countLoading ? '載入中…' : '0')} 筆訂單需要處理</h2>

        {/* Waitlist summary (flexible: supports numeric or object-shaped statusCounts entries) */}
        {(() => {
          const w = statusCounts?.waitlist ?? null;
          if (w == null) return null;
          const format = (v: any) => {
            if (v == null) return null;
            if (typeof v === 'number') {
              if (v === 0) return null;
              return `包括 ${v} 筆候補中訂單`;
            }
            if (typeof v === 'object') {
              const possible = v.total ?? v.amount ?? v.order_total ?? v.order_total_amount ?? v.orders ?? v.items ?? null;
              if (typeof possible === 'number') {
                if (possible === 0) return null;
                if ('total' in v || 'amount' in v || 'order_total' in v || 'order_total_amount' in v) return `待補貨總額: HK$${possible.toLocaleString()}`;
                return `包括 ${possible} 筆候補中訂單`;
              }
              return null;
            }
            return String(v);
          };
          const txt = format(w);
          return txt ? <div className="text-xs text-gray-600 mb-4">{txt}</div> : null;
        })()}
            </div>
            <div className="ml-4 flex-shrink-0">
              <Link href="/admin/orders/restock">
                <Button className="text-xs  h-6 w-24 bg-primary text-white hover:bg-primary/90 focus-visible:ring-0">
                  切換補貨管理頁
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Chips (status chips + customer list) moved out to full-width container so list can span the screen */}
      <div className="w-full px-4">
        <div className="mx-auto w-full max-w-[1200px]">
          <Chips statusCounts={statusCounts} onOpenCustomer={(id: string, status?: string) => { setModalCustomerId(id); setModalPriorityStatus(status ?? null); setModalOpen(true); }} onOpenBatch={(keys: string[], custIds: string[], status: string | 'all') => {
            setBatchModalSelectedOrderKeys(keys)
            setBatchModalCustomerIds(custIds)
            setBatchModalStatusFilter(status)
            setBatchModalOpenTop(true)
          }} />
        </div>
      </div>

      
      
      <OrderDetailsModalAll open={modalOpen} onOpenChange={(v: boolean) => { setModalOpen(v); if (!v) { setModalCustomerId(null); setModalPriorityStatus(null); } }} customerId={modalCustomerId} priorityStatus={modalPriorityStatus} />

      <BatchConfirmModal
        open={batchModalOpenTop && batchModalStatusFilter === 'allocated'}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />

      <BatchPackingModal
        open={batchModalOpenTop && batchModalStatusFilter === 'verified'}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />

      <BatchPaymentReminderModal
        open={batchModalOpenTop && batchModalStatusFilter === 'confirmed'}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />

      <BatchRestockReminderModal
        open={batchModalOpenTop && (batchModalStatusFilter === 'stock_arrived_contact' || batchModalStatusFilter === 'waitlist')}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />

      <BatchVerifiedModal
        open={batchModalOpenTop && batchModalStatusFilter === 'paid'}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />

      <BatchShippingModal
        open={batchModalOpenTop && batchModalStatusFilter === 'pending_to_ship'}
        onOpenChange={(v) => {
          setBatchModalOpenTop(v)
          if (!v) {
            setBatchModalSelectedOrderKeys([])
            setBatchModalCustomerIds([])
            setBatchModalStatusFilter('all')
          }
        }}
        selectedOrderKeys={batchModalSelectedOrderKeys}
        customerIds={batchModalCustomerIds}
        statusFilter={batchModalStatusFilter}
        onConfirm={(selected) => { setBatchModalSelectedOrderKeys([]); setBatchModalCustomerIds([]); setBatchModalOpenTop(false); }}
      />
      
      
    </div>
  );
}

function Chips({ statusCounts, onOpenCustomer, onOpenBatch }: { statusCounts?: Record<string, number> | null; onOpenCustomer: (id: string, status?: string) => void; onOpenBatch?: (keys: string[], custIds: string[], status: string | 'all') => void }) {
  const [selected, setSelected] = useState<string | 'all'>('paid');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(20);

  const chips = [
    // 'waitlist' chip hidden per request
    { key: 'stock_arrived_contact', label: '到貨通知', count: statusCounts?.stock_arrived_contact },
    { key: 'confirmed', label: '待付款', count: statusCounts?.confirmed },
    { key: 'paid', label: '待核數', count: statusCounts?.paid },
    { key: 'verified', label: '待執貨', count: statusCounts?.verified },
    { key: 'pending_to_ship', label: '待寄貨', count: statusCounts?.pending_to_ship },
  ];

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex flex-wrap gap-3 items-center">
      {chips.map((c) => {
        const active = selected === c.key;
        const count = c.count;
        const display = typeof count === 'number' ? count : '-';
        return (
          <button
            key={c.key}
            onClick={() => setSelected(c.key)}
            className={`relative px-2 py-2 rounded-full text-xs font-medium flex items-center gap-2 overflow-visible ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <span>{c.label}</span>
            {typeof count === 'number' && count > 0 && (
              <Badge className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] p-0 shadow ${active ? 'bg-red-600 text-white' : 'bg-red-600 text-white'}`}>{display}</Badge>
            )}
          </button>
        );
      })}

      
      </div>

      <CustomerList
        statusFilter={selected}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        onOpenCustomer={(id: string) => onOpenCustomer(id, selected)}
        onOpenBatch={onOpenBatch}
      />
    </div>
  );
}

// fetch when selected/page/perPage change
function useFetchOrders(statusFilter: string | 'all', page: number, perPage: number, urgentOnly: boolean = false) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[] | null>(null);
  const [meta, setMeta] = useState<any | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      try {
        // Special-case: when requesting 'verified' view, also include items
        // with status 'pre_pending_to_ship' so they appear under the
        // `待執貨` chip. We fetch both and merge by customer.
        if (statusFilter === 'verified') {
          const [a, b] = await Promise.all([
            getMasterOrderList('verified', page, perPage, urgentOnly),
            getMasterOrderList('pre_pending_to_ship', page, perPage, urgentOnly),
          ]);

          // merge rows by customer identifier (customer_id preferred)
          const map: Record<string, any> = {};
          const addRows = (rowsArr: any[]) => {
            (rowsArr || []).forEach((c: any) => {
              const key = c.customer_id ?? c.phone ?? c.customer_name ?? Math.random().toString(36).slice(2, 9);
              if (!map[key]) map[key] = { ...c, orders: Array.isArray(c.orders) ? [...c.orders] : [] };
              else map[key].orders = (map[key].orders || []).concat(Array.isArray(c.orders) ? c.orders : []);
              // recompute matching_order_count if present
              map[key].matching_order_count = (map[key].matching_order_count || 0) + (c.matching_order_count || (c.orders ? c.orders.length : 0));
            });
          };

          addRows(a.rows || []);
          addRows(b.rows || []);

          const mergedRows = Object.values(map).map((r: any) => ({ ...r }));

          const mergedMeta = {
            current_page: a.metadata?.current_page ?? page,
            per_page: a.metadata?.per_page ?? perPage,
            total_pages: a.metadata && b.metadata ? Math.max(a.metadata.total_pages ?? 1, b.metadata.total_pages ?? 1) : a.metadata?.total_pages ?? b.metadata?.total_pages ?? 1,
            total_results: (a.metadata?.total_results ?? (a.rows ? a.rows.length : 0)) + (b.metadata?.total_results ?? (b.rows ? b.rows.length : 0)),
          };

          const mergedStatusCounts: Record<string, number> = {};
          [a.statusCounts, b.statusCounts].forEach((sc) => {
            if (!sc) return;
            Object.entries(sc).forEach(([k, v]) => {
              const n = typeof v === 'number' ? v : ((v as any)?.orders ?? (v as any)?.items ?? 0);
              mergedStatusCounts[k] = (mergedStatusCounts[k] || 0) + (n || 0);
            });
          });

          if (mountedRef.current) {
            setData(mergedRows);
            setMeta(mergedMeta);
            if (Object.keys(mergedStatusCounts).length) setStatusCounts(mergedStatusCounts);
          }
        } else {
          const resp = await getMasterOrderList(statusFilter === 'all' ? 'all' : statusFilter, page, perPage, urgentOnly);
          if (mountedRef.current) {
            setData(resp.rows);
            setMeta(resp.metadata);
            if (resp.statusCounts) setStatusCounts(resp.statusCounts);
          }
        }
      } catch (err) {
        console.error('fetch get_master_order_list', err);
        if (mountedRef.current) {
          setData([]);
          setMeta(null);
        }
      }
    } catch (err) {
      console.error('fetch get_master_order_list', err);
      if (mountedRef.current) {
        setData([]);
        setMeta(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    try {
      // register this fetchData globally so realtime publisher can call it
      const w: any = window as any;
      w.__orders_fetchers = w.__orders_fetchers || [];
      // attach a stable id to the fetcher for debugging
      try { if (!(fetchData as any).__orders_fetcher_id) (fetchData as any).__orders_fetcher_id = 'f_' + Math.random().toString(36).slice(2, 8); } catch (e) {}
      if (!w.__orders_fetchers.includes(fetchData)) w.__orders_fetchers.push(fetchData);
    } catch (e) {}

    return () => {
      mountedRef.current = false;
      try {
        const w: any = window as any;
        if (w.__orders_fetchers && Array.isArray(w.__orders_fetchers)) {
          const idx = w.__orders_fetchers.indexOf(fetchData);
          if (idx > -1) w.__orders_fetchers.splice(idx, 1);
        }
      } catch (e) {}
    };
  }, [statusFilter, page, perPage, urgentOnly]);

  useEffect(() => {
    // Debounce rapid realtime events to avoid spamming RPC calls which can
    // cause UI flicker (modal unmount/remount or content reloading).
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (ev: Event) => {
      try {
        const d: any = (ev as CustomEvent).detail || {};
        // If publisher flagged this as immediate (e.g. an INSERT), fetch now.
        const isInsert = d?.immediate || (d?.typeNormalized || '').toUpperCase() === 'INSERT';
        if (isInsert) {
          try {
            try {
              const a: any = (window as any).__orders_alert_audio;
              if (a && typeof a.play === 'function') {
                try {
                  a.currentTime = 0;
                  a.play().catch((err: any) => console.warn('audio play failed', err));
                } catch (e) {
                  console.warn('audio play error', e);
                }
              }
            } catch (e) {
              console.warn('no alert audio available', e);
            }

            try {
              try {
                // Prefer explicit `customer_name` fields from common payload shapes.
                const owner = d?.new?.customer_name ?? d?.record?.customer_name ?? d?.payload?.new?.customer_name ?? d?.customer_name ?? null;
                const ownerName = owner ? String(owner) : null;
                // Only show toast when we have a customer_name; remove generic fallback.
                if (ownerName) {
                  const title = `恭喜! 你有一張新訂單`;
                  toast({
                    title,
                    description: (
                      <span className="text-xs">來自: {ownerName}</span>
                    ),
                    open: true,
                  });
                }
              } catch (e) {}
            } catch (e) {}

            fetchData();
          } catch (e) {
            console.warn('immediate fetchData failed', e);
          }
          return;
        }
      } catch (e) {}

      // Debounce non-immediate events: wait 700ms after the last one.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchData();
        timer = null;
      }, 700);
    };

    window.addEventListener('orders:refresh', handler as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('orders:refresh', handler as EventListener);
    };
  }, [statusFilter, page, perPage, urgentOnly]);

  return { loading, data, meta, statusCounts };
}

function CustomerList({ statusFilter, page, perPage, onPageChange, onOpenCustomer, onOpenBatch }: { statusFilter: string | 'all'; page: number; perPage: number; onPageChange: (p: number) => void; onOpenCustomer: (id: string) => void; onOpenBatch?: (keys: string[], custIds: string[], status: string | 'all') => void }) {
  const [showUnder4Only, setShowUnder4Only] = useState<boolean>(false);
  const { loading, data, meta } = useFetchOrders(statusFilter, page, perPage, showUnder4Only);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // collapse all customer items when filter or pagination changes
    setExpanded({});
    // clear any selected checkboxes when the view (choice chip) changes
    setSelectedOrders({});
  }, [statusFilter, page, perPage]);

  const toggle = (id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  const toggleOrderSelection = (orderKey: string) => {
    setSelectedOrders((s) => ({ ...s, [orderKey]: !s[orderKey] }));
  };

  const [batchModalOpen, setBatchModalOpen] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && !!(window as any).__isBatchModalOpen
    } catch (e) {
      return false
    }
  });

  const toggleCustomerSelection = (cust: any) => {
    const keys: string[] = (cust.orders || []).map((o: any, idx: number) => o.order_number || `${cust.customer_id}_${idx}`);
    const allSelected = keys.length > 0 && keys.every((k) => !!selectedOrders[k]);
    const newVal = !allSelected;
    setSelectedOrders((s) => {
      const copy = { ...s };
      keys.forEach((k) => { copy[k] = newVal; });
      return copy;
    });
  };

  const handleCustomerAction = (cust: any) => {
    const keys: string[] = (cust.orders || []).map((o: any, idx: number) => o.order_number || `${cust.customer_id}_${idx}`);
    const selected = keys.filter((k) => !!selectedOrders[k]);
    if (statusFilter === 'allocated') {
      // ensure this customer's orders are selected (if none selected), then open batch modal
      if (selected.length === 0) {
        setSelectedOrders((s) => {
          const copy = { ...s };
          keys.forEach((k) => { copy[k] = true; });
          return copy;
        });
      }
      if (onOpenBatch) onOpenBatch(Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]).length ? Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]) : keys, [cust.customer_id], statusFilter)
      return;
    }
    // If status is 'paid' (核對數紙), open the verified batch modal for this customer
    if (statusFilter === 'paid') {
      if (selected.length === 0) {
        setSelectedOrders((s) => {
          const copy = { ...s };
          keys.forEach((k) => { copy[k] = true; });
          return copy;
        });
      }
      if (onOpenBatch) onOpenBatch(Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]).length ? Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]) : keys, [cust.customer_id], statusFilter)
      return;
    }
    // If status is 'verified' (打包執貨), open the packing modal for this customer
    if (statusFilter === 'verified') {
      if (selected.length === 0) {
        setSelectedOrders((s) => {
          const copy = { ...s };
          keys.forEach((k) => { copy[k] = true; });
          return copy;
        });
      }
      // Always open the packing modal for this customer's orders.
      // Use `keys` (this customer's orders) to avoid relying on async state update.
      if (onOpenBatch) onOpenBatch(keys, [cust.customer_id], 'verified')
      return;
    }
    // If status is 'pending_to_ship' (完成寄貨), open the shipping modal for this customer
    if (statusFilter === 'pending_to_ship') {
      if (selected.length === 0) {
        setSelectedOrders((s) => {
          const copy = { ...s };
          keys.forEach((k) => { copy[k] = true; });
          return copy;
        });
      }
      if (onOpenBatch) onOpenBatch(Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]).length ? Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]) : keys, [cust.customer_id], statusFilter)
      return;
    }
    // 如果是「待付款」(confirmed)，則直接開啟 WhatsApp 並帶入預設訊息
    if (statusFilter === 'confirmed') {
      try {
        const name = cust.customer_name ?? '客戶'
        const phoneRaw = (cust.phone || '')
        const phone = phoneRaw.replace(/[^0-9+]/g, '')
        const orderNumbers = (cust.orders || []).map((o: any) => o.order_number).filter(Boolean).join(', ') || '—'
        const numOrders = (cust.orders || []).length
        const total = ((cust.orders || []).reduce((sum: number, o: any) => {
          const v = Number(o.order_total ?? o.order_total_amount ?? o.total ?? 0) || 0
          return sum + v
        }, 0)).toLocaleString()

        // compute earliest payment deadline across this customer's orders (check item-level deadlines)
        const paymentDeadlines = (cust.orders || []).flatMap((o: any) => (o.items || []).map((it: any) => it.payment_deadline || it.deadline).filter(Boolean));
        let formattedDeadline: string | null = null;
        let hoursRemainingText: string | null = null;
        if (paymentDeadlines.length > 0) {
          const parsed = paymentDeadlines.map((d: string) => Date.parse(d)).filter((t: number) => !isNaN(t));
          if (parsed.length > 0) {
            const earliest = Math.min(...parsed);
            formattedDeadline = new Date(earliest).toLocaleString();
            // compute hours remaining and use at least 1 hour to avoid "0 小時"
            const hoursRemaining = Math.max(1, Math.ceil((earliest - Date.now()) / (1000 * 60 * 60)));
            hoursRemainingText = `${hoursRemaining}`;
          }
        }
        const deadlineText = formattedDeadline && hoursRemainingText ? `還有 ${hoursRemainingText} 小時（截止： ${formattedDeadline}）` : `請於12小時內完成`;

        // build exact requested template for single-customer quick message
        const hoursText = hoursRemainingText ?? '12'
        const txs = Array.from(new Set((cust.orders || []).map((o: any) => o.transaction_id).filter(Boolean)));
        const payPath = txs.length > 0 ? `/pay/${txs[0]}` : null
        const payUrl = (payPath && typeof window !== 'undefined') ? `${window.location.origin}${payPath}` : ''
        const baseMsg = `嗨 ${name} 👋\n\n你嘅訂單 ${orderNumbers}（共 ${numOrders} 張），總金額 HK$${total}。\n\n`
        let finalMsg = `${baseMsg}`

        finalMsg += `我們已為你準備付款連結：${payUrl}\n\n`
        finalMsg += `請於${hoursText} 小時內點擊以上連結付款。\n\n`
        finalMsg += `限時過後仍未收到付款系統自動取消並當棄單。\n如有查詢，請直接回覆此訊息。\n\n多謝你！🙏\n\n`

        if (txs.length > 0) {
          finalMsg += `交易編號: ${txs.join(', ')}\n\n`
        }

        if (formattedDeadline) {
          finalMsg += `截止時間： ${new Date(Math.min(...(paymentDeadlines.map((d: string) => Date.parse(d)).filter((t: number) => !isNaN(t))))) .toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        }

        if (phone && typeof window !== 'undefined') {
          const url = `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(finalMsg)}`
          window.open(url, '_blank')
        } else {
          console.warn('No phone available to send WhatsApp message for customer', cust)
        }
      } catch (e) {
        console.error('Failed to open WhatsApp reminder', e)
      }
      return
    }

    // Open batch restock/arrival notification modal for 到貨通知 or waitlist
    if (statusFilter === 'stock_arrived_contact' || statusFilter === 'waitlist') {
      const keys: string[] = (cust.orders || []).map((o: any, idx: number) => o.order_number || `${cust.customer_id}_${idx}`);
      const selected = keys.filter((k) => !!selectedOrders[k]);
      if (selected.length === 0) {
        setSelectedOrders((s) => {
          const copy = { ...s };
          keys.forEach((k) => { copy[k] = true; });
          return copy;
        });
      }
      if (onOpenBatch) onOpenBatch(Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]).length ? Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]) : keys, [cust.customer_id], statusFilter)
      return;
    }

    
  };

  const actionLabel = (() => {
    const map: Record<string, string | null> = {
      stock_arrived_contact: '發送到貨通知',
      // legacy key kept for compatibility
      waitlist: '發送到貨通知',
      allocated: '發送付款通知',
      confirmed: '發送付款提醒',
      paid: '核對數紙',
      verified: '打包執貨',
      pending_to_ship: '完成寄貨',
    };
    return map[statusFilter] ?? null;
  })();

  const anySelected = Object.values(selectedOrders).some((v) => !!v);

  const handleBulkAction = () => {
    const selected = Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]);
    // Explicitly handle the packing case so the packing modal opens reliably.
    if (statusFilter === 'verified') {
      if (onOpenBatch) onOpenBatch(selected.length ? selected : selected, customerIdsForModal, 'verified')
      return;
    }

    if (statusFilter === 'allocated' || statusFilter === 'confirmed' || statusFilter === 'paid' || statusFilter === 'pending_to_ship') {
      // open batch modal for allocated (confirm), confirmed (payment reminder), or paid (verify)
      if (onOpenBatch) onOpenBatch(selected.length ? selected : selected, customerIdsForModal, statusFilter)
      return;
    }

      // open restock/arrival notification modal for stock_arrived_contact or legacy waitlist
      if (statusFilter === 'stock_arrived_contact' || statusFilter === 'waitlist') {
        if (onOpenBatch) onOpenBatch(selected.length ? selected : selected, customerIdsForModal, statusFilter)
        return;
      }
    
  };

  // ListStatusLabel and ListStatusBg are imported from lib/orderStatus

  const rows = Array.isArray(data) ? data : [];

  const getEarliestDeadlineTs = (cust: any): number | null => {
    const paymentDeadlines = (cust.orders || []).map((o: any) => o.payment_deadline || o.deadline).filter(Boolean);
    if (paymentDeadlines.length === 0) return null;
    const parsed = paymentDeadlines.map((d: string) => {
      const t = Date.parse(d);
      return isNaN(t) ? null : t;
    }).filter((v: number | null) => v !== null) as number[];
    if (parsed.length === 0) return null;
    return Math.min(...parsed);
  };

  const filteredRows = rows;

  if (loading) return <div className="text-sm text-gray-500 mt-4">載入中…</div>;

  const selectedOrderKeysList = Object.keys(selectedOrders).filter((k) => !!selectedOrders[k]);
  const customerIdsForModal = rows
    .filter((cust: any) => (cust.orders || []).some((o: any) => selectedOrderKeysList.includes(o.order_number)))
    .map((c: any) => c.customer_id)
    .filter(Boolean);

  // Do not early-return when there are no rows so the header and
  // controls (e.g. urgent toggle) remain visible. Show a placeholder
  // inside the list area instead.

  return (
    <div className="w-full space-y-4 pt-4">
     
     
      <div className="w-full flex text-xs items-center justify-between gap-4">
        <div className="flex-1 flex items-start gap-4">
          {statusFilter === 'confirmed' && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowUnder4Only((s) => !s); }}
              className={`w-46 px-2 py-2 rounded-full text-xs ${showUnder4Only ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              顯示付款期限小於4小時的訂單
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center gap-4 justify-end">
          {(Number(meta?.total_results) > 1) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // gather all order keys visible in the list
                const allKeys: string[] = filteredRows.flatMap((cust: any) => (cust.orders || []).map((o: any, idx: number) => o.order_number || `${cust.customer_id}_${idx}`));
                const allSelected = allKeys.length > 0 && allKeys.every((k) => !!selectedOrders[k]);
                if (allSelected) {
                  // deselect all
                  setSelectedOrders({});
                } else {
                  const newSel: Record<string, boolean> = {};
                  allKeys.forEach((k) => { newSel[k] = true; });
                  setSelectedOrders(newSel);
                }
              }}
              className="text-xs text-gray-700"
            >
              全部選取
            </button>
          )}

          <div className="text-gray-700">{meta?.total_results} 筆訂單</div>
        </div>
      </div>


      {/* list */}
      <List className="w-full space-y-4 max-w-[500px] mx-auto">
        {filteredRows.length === 0 ? (
          <EmptyWidget className="mt-4" />
        ) : filteredRows.map((cust: any) => {
          const id = cust.customer_id || cust.phone || Math.random().toString(36).slice(2, 9);
          const isOpen = !!expanded[id];
          // compute closest (earliest) payment deadline across this customer's orders
          const paymentDeadlines = (cust.orders || []).map((o: any) => o.payment_deadline || o.deadline).filter(Boolean);
          let deadlineLabel: string | null = null;
          let formattedDeadlineStr: string | null = null;
          if (paymentDeadlines.length > 0) {
            try {
              const parsed = paymentDeadlines.map((d: string) => {
                const t = Date.parse(d);
                return isNaN(t) ? null : t;
              }).filter((v: number | null) => v !== null) as number[];
              if (parsed.length > 0) {
                const earliestTs = Math.min(...parsed);
                const now = Date.now();
                const hoursRemaining = (earliestTs - now) / (1000 * 60 * 60);
                if (hoursRemaining > 0) {
                  if (hoursRemaining < 0.25) deadlineLabel = '<15 分鐘';
                  else if (hoursRemaining <= 4) deadlineLabel = '<4 小時';
                  else if (hoursRemaining <= 12) deadlineLabel = '<12 小時';
                  else deadlineLabel = '>12 小時';
                }
                formattedDeadlineStr = new Date(earliestTs).toLocaleString();
              }
            } catch (e) {
              deadlineLabel = null;
              formattedDeadlineStr = null;
            }
          }

          const header = (
            <>
              <div>
                <div className="text-xs font-bold">{cust.customer_name || '—'} | {cust.phone}</div>
                <div className="text-[10px] text-gray-500">
                 
                  {((cust.matching_action_count ?? null) !== null) && (
                    <span className="">{cust.matching_action_count} 張訂單</span>
                  )}
                </div>
                {statusFilter === 'confirmed' && (
                  deadlineLabel && (
                    <div className={`text-[10px] mt-2 rounded-full text-center p-1 ${(deadlineLabel === '<4 小時' || deadlineLabel === '<15 分鐘') ? 'bg-red-600 text-white' : 'bg-primary text-white'}`}>{`付款限期: ${deadlineLabel}`}</div>
                  )
                )}
              </div>
            </>
          );

          const left = (
            <>
              {statusFilter !== 'all' && (Number(meta?.total_results) > 1) && (
                (() => {
                  const keys: string[] = (cust.orders || []).map((o: any, idx: number) => o.order_number || `${cust.customer_id}_${idx}`);
                  const allSelected = keys.length > 0 && keys.every((k) => !!selectedOrders[k]);
                  const someSelected = keys.some((k) => !!selectedOrders[k]) && !allSelected;
                  return (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onClick={(e) => { e.stopPropagation(); }}
                      onChange={(e) => { e.stopPropagation(); toggleCustomerSelection(cust); }}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      className="mr-2 h-5 w-5 accent-primary"
                    />
                  );
                })()
              )}
            </>
          );

          const right = (
            <>
              {actionLabel && (
                <Button className="px-2 h-6 text-xs rounded-lg" onClick={(e) => { e.stopPropagation(); handleCustomerAction(cust); }}>
                  {actionLabel}
                </Button>
              )}
              <button onClick={(e) => { e.stopPropagation(); toggle(id); }} className="text-xs ml-2">
                {isOpen ? '▲' : '▼'}
              </button>
            </>
          );

          return (
            <ListItem key={id} id={id} left={left} header={header} right={right} isOpen={isOpen} onToggle={() => toggle(id)}>
              {['confirmed', 'paid', 'verified', 'pending_to_ship'].includes(String(statusFilter)) ? (
                (() => {
                  // group orders by transaction_id
                  const groups: Record<string, any[]> = (cust.orders || []).reduce((acc: Record<string, any[]>, o: any) => {
                    const tx = o.transaction_id ?? '未生成交易';
                    if (!acc[tx]) acc[tx] = [];
                    acc[tx].push(o);
                    return acc;
                  }, {});
                  return Object.entries(groups).map(([tx, orders], idx2) => {
                      const representative = orders[0] || {};
                      const label = ListStatusLabel[representative.status] || representative.status || '狀態';
                      const bg = ListStatusBg[representative.status] || 'bg-gray-100';
                    return (
                      <div key={tx + '_' + idx2} onClick={(e) => { e.stopPropagation(); if (cust.customer_id) onOpenCustomer(cust.customer_id); }} className={`flex items-center justify-between px-4 py-3 rounded-full ${bg} cursor-pointer hover:bg-gray-50`}>
                        <div className="flex flex-col">
                          <div className="text-[10px] text-gray-500">交易號碼</div>
                          <div className=" font-semibold">{tx}</div>
                         
                        </div>
                        <div className="flex items-center gap-2">
                          {(orders || []).some((it: any) => it.is_customer_created) ? (
                            <div className="text-[10px] text-black bg-gray-200 inline-block px-2 py-0.5 rounded-full">顧客建立訂單</div>
                          ) : null}
                          <div className="text-[10px]">{label}</div>
                        </div>
                      </div>
                    )
                  })
                })()
              ) : (
                (cust.orders || []).map((o: any, idx: number) => {
                  const label = ListStatusLabel[o.status] || o.status || '狀態';
                  const bg = ListStatusBg[o.status] || 'bg-gray-100';
                  return (
                    <div key={idx} onClick={(e) => { e.stopPropagation(); if (cust.customer_id) onOpenCustomer(cust.customer_id); }} className={`flex items-center justify-between px-4 py-3 rounded-full ${bg} cursor-pointer hover:bg-gray-50`}>
                      <div className="flex flex-col">
                        <div className="text-[9px] text-gray-500 mb-1">交易號碼</div>
                        <div className="flex justify-between items-center gap-2">  
                          <div className="pl-2 text-xs text-black font-semibold">{o.transaction_id}</div>
                         
                        </div>
                      </div>
                     <div className="flex gap-2">
                      {o.is_customer_created ? (
                            <div className="pl-2 text-[10px] text-black bg-gray-200 inline-block px-2 py-0.5 rounded-full">顧客建立訂單</div>
                          ) : null}
                      <div className="text-[10px]">{label}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Bulk action button (appears when any checkbox selected) */}
      {anySelected && actionLabel && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <Button className="px-4 py-2 bg-primary text-white" onClick={(e) => { e.stopPropagation(); handleBulkAction(); }}>
            批量{actionLabel}
          </Button>
        </div>
      )}

      {/* BatchConfirmModal moved to top-level OrdersPage to avoid remounts */}

      {/* Pagination controls (fixed bottom-center, responsive) */}
      {(Number(meta?.total_results) > 1) && (
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-10 w-[90%] sm:w-auto max-w-[640px] pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-center gap-2 bg-white/90 backdrop-blur-sm  px-3 py-2  w-full">
          <Button
            variant="outline"
            className="p-2 border-0"
            disabled={meta ? meta.current_page <= 1 : page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="上一頁"
          >
            <Lucide.ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="px-2 text-sm text-gray-700">第 {meta?.current_page ?? page} / {meta?.total_pages ?? '-'} 頁</div>

          <Button
            variant="outline"
            className="p-2 border-0"
            disabled={meta ? meta.current_page >= (meta.total_pages ?? 1) : false}
            onClick={() => onPageChange(Math.min(meta?.total_pages ?? (page + 1), (meta?.current_page ?? page) + 1))}
            aria-label="下一頁"
          >
            <Lucide.ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
