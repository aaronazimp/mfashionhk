"use client";

import React, { useEffect, useState } from "react";
import { getRestockAllocationData, processBulkRestock } from "@/lib/orderService";
import type { RestockVariation, RestockSku, RestockAllocationData, RestockAllocationResponse, RestockSize, RestockColor } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

import ImageFullscreen from "./ImageFullscreen";


interface RestockWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sku?: string;
  // optional initial variations or full SKU payload; otherwise demo data is used
  // now expect the canonical RPC-shaped SKU payload
  initial?: RestockSku | RestockAllocationData | RestockAllocationResponse;
}

function SkuSummary({ sku, rows, children, preview, totalWaitlistOrdersCount, onPreviewClick }: { sku: string; rows: RestockVariation[]; children?: React.ReactNode; preview?: string | null; totalWaitlistOrdersCount?: number | undefined; onPreviewClick?: () => void }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-28 h-40 bg-gray-100 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
        {preview ? (
          // use plain img to avoid Next/Image domain config issues in the wizard
          <img
            src={preview}
            alt={sku}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => onPreviewClick?.()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreviewClick?.(); } }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}
      </div>
      <div className="flex-1">
        <div className="font-bold text-xs">{sku}</div>
        <div className="text-[10px] text-gray-500 mt-1">共有 {rows.length} 個變體</div>
        <div className="mt-2 font-bold text-[10px]">候補總數：{totalWaitlistOrdersCount} 件</div>
      </div>
    </div>
  );
}

function EmptyWidget({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center text-gray-500">
      <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/></svg>
      </div>
      <div className="font-semibold text-sm">{title ?? '無資料'}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

export default function RestockWizard({ isOpen, onClose, sku = "R20260305M02", initial }: RestockWizardProps) {
  let initialRows: RestockVariation[] = [];
  if (initial && typeof initial === "object" && (initial as RestockSku).sizes) {
    const skuInit = initial as RestockSku;
    initialRows = skuInit.sizes.flatMap((s) => {
      const sizeName = s.size ?? "";
      return (s.colors || []).map((c: RestockColor) => ({
        variation_id: Number(c.variation_id),
        id: String(c.variation_id),
        size: sizeName ?? undefined,
        color: c.color,
        // RPC-provided waitlist count (if present)
          waitlist: c.waitlist_count !== undefined ? Number(c.waitlist_count) : undefined,
              // remaining preorder spots (RPC field)
              remaining_preorder_spots: c.remaining_preorder_spots !== undefined ? Number(c.remaining_preorder_spots) : undefined,
          // new RPC fields
          waitlist_qty: c.waitlist_qty !== undefined ? Number(c.waitlist_qty) : undefined,
          confirmed_qty: c.confirmed_qty !== undefined ? Number(c.confirmed_qty) : undefined,
          waitlist_orders_count: c.waitlist_orders_count !== undefined ? Number(c.waitlist_orders_count) : undefined,
          
        // canonical RPC fields
        ordered_qty: c.ordered_qty !== undefined ? Number(c.ordered_qty) : undefined,
        orders_count: c.orders_count !== undefined ? Number(c.orders_count) : undefined,
        current_stock: c.current_stock !== undefined ? Number(c.current_stock) : undefined,
        reels_quota: c.reels_quota,
        current_quota: c.current_quota ?? c.reels_quota,
        currentQty: c.calculated_stock,
        waitlistOrders: c.waitlist_orders ?? undefined,
      } as RestockVariation));
    });
    // If initial payload contains SKU-level waitlist_orders, attach them to matching variations
    if (Array.isArray((skuInit as any).waitlist_orders)) {
      const orders: any[] = (skuInit as any).waitlist_orders;
      const byVid: Record<string, any[]> = {};
      for (const o of orders) {
        const vid = String(o.variation_id ?? o.variationId ?? o.variation);
        byVid[vid] = byVid[vid] || [];
        byVid[vid].push(o);
      }
      initialRows = initialRows.map((r) => ({ ...r, waitlistOrders: (r.waitlistOrders || []).concat(byVid[r.id] || []) } as RestockVariation));
    }
  }

  const [step, setStep] = useState<number>(1);
  const [rows, setRows] = useState<RestockVariation[]>(initialRows);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string[]>>({});
  const [allocationPreview, setAllocationPreview] = useState<Record<string, string[]>>({});
  const [selectionErrors, setSelectionErrors] = useState<Record<string, string | undefined>>({});
  const [processing, setProcessing] = useState(false);
  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [restockPayloadMap, setRestockPayloadMap] = useState<Record<string, { variation_id: number | string; restock_amount: number; order_ids: string[] }>>({});
  const [quotaFromRpc, setQuotaFromRpc] = useState<Record<string, number | undefined>>({});
  const [rpcPayload, setRpcPayload] = useState<any | null>(null);
  const [showRpcDebug, setShowRpcDebug] = useState<boolean>(false);
  const [showPayloadDebug, setShowPayloadDebug] = useState<boolean>(false);
  const [showProcessResult, setShowProcessResult] = useState<boolean>(false);
  const [lastProcessResult, setLastProcessResult] = useState<any | null>(null);
  const [lastPayloadToSend, setLastPayloadToSend] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setRows(initialRows);
      setSelectedVariationIndex(0);
      setSelectedCustomers({});
      setAllocationPreview({});
      setPreviewImage(null);
    }
  }, [isOpen]);

  // reset all internal wizard state
  const resetWizardState = () => {
    setStep(1);
    setRows(initialRows);
    setSelectedVariationIndex(0);
    setSelectedCustomers({});
    setAllocationPreview({});
    setSelectionErrors({});
    setProcessing(false);
    setRestockAmounts({});
    setRestockPayloadMap({});
    setPreviewImage(null);
    setLastProcessResult(null);
    setLoadingData(false);
  };

  const handleClose = () => {
    resetWizardState();
    onClose();
  };

  // Fetch allocation data from RPC when wizard opens with a sku prop
  const [loadingData, setLoadingData] = useState(false);
  useEffect(() => {
    const fetchAllocation = async () => {
      if (!isOpen) return;
      const skuId = parseInt(String(sku ?? ""));
      if (!skuId || Number.isNaN(skuId)) return;
      setLoadingData(true);
      try {
        const data = await getRestockAllocationData(skuId);
        let payload: any = data;
        if (Array.isArray(data) && data.length > 0 && data[0].get_restock_allocation_data) payload = data[0].get_restock_allocation_data;
        else if (data && data.get_restock_allocation_data) payload = data.get_restock_allocation_data;

        // canonical RPC payload expected: has `sizes` array
        setRpcPayload(payload);
        const mainPreview = payload?.main_preview_image ?? null;
        if (mainPreview) setPreviewImage(String(mainPreview));

        if (payload?.sizes && Array.isArray(payload.sizes)) {
          const skuPayload = payload as RestockSku;
          const mapped: RestockVariation[] = skuPayload.sizes.flatMap((s: RestockSize) => {
            const sizeName = s.size ?? "";
            return (s.colors || []).map((c: RestockColor) => ({
              variation_id: Number(c.variation_id),
              id: String(c.variation_id),
              size: sizeName ?? undefined,
              color: c.color,
              	waitlist: c.waitlist_count !== undefined ? Number(c.waitlist_count) : undefined,
                // remaining preorder spots (RPC field)
                remaining_preorder_spots: c.remaining_preorder_spots !== undefined ? Number(c.remaining_preorder_spots) : undefined,
              // map new RPC fields into the variation shape
              waitlist_qty: c.waitlist_qty !== undefined ? Number(c.waitlist_qty) : undefined,
              confirmed_qty: c.confirmed_qty !== undefined ? Number(c.confirmed_qty) : undefined,
              waitlist_orders_count: c.waitlist_orders_count !== undefined ? Number(c.waitlist_orders_count) : undefined,
              
              ordered_qty: c.ordered_qty !== undefined ? Number(c.ordered_qty) : undefined,
              orders_count: c.orders_count !== undefined ? Number(c.orders_count) : undefined,
              	current_stock: c.current_stock !== undefined ? Number(c.current_stock) : undefined,
              	calculated_stock: (c.calculated_stock !== undefined ? Number(c.calculated_stock) : (c.available_qty !== undefined ? Number(c.available_qty) : (c.current_stock !== undefined ? Number(c.current_stock) : 0))),
              reels_quota: c.reels_quota,
              current_quota: c.current_quota ?? c.reels_quota,
              currentQty: c.current_stock !== undefined ? Number(c.current_stock) : undefined,
              waitlistOrders: c.waitlist_orders ?? undefined,
            } as RestockVariation));
          });

          // If RPC returned SKU-level waitlist_orders (new shape), fold them into matching variations
          if (Array.isArray((payload as any).waitlist_orders)) {
            const orders: any[] = (payload as any).waitlist_orders;
            const byVid: Record<string, any[]> = {};
            for (const o of orders) {
              const vid = String(o.variation_id ?? o.variationId ?? o.variation);
              byVid[vid] = byVid[vid] || [];
              byVid[vid].push(o);
            }
            for (const mv of mapped) {
              if (byVid[mv.id]) mv.waitlistOrders = (mv.waitlistOrders || []).concat(byVid[mv.id]);
            }
          }

          if (mapped.length > 0) {
            setRows(mapped);
            const qmap: Record<string, number | undefined> = {};
            for (const it of mapped) qmap[it.id] = it.current_quota as number | undefined;
            setQuotaFromRpc(qmap);
            setSelectedVariationIndex(0);
            setSelectedCustomers({});
            setAllocationPreview({});
          }
        }
      } catch (err) {
        // swallow for now; caller can inspect logs
        // eslint-disable-next-line no-console
        console.error("get_restock_allocation_data error:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllocation();
  }, [isOpen, sku]);

  // Helpers
  const updateQty = (id: string, qty: number) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, currentQty: qty } : x)));
  };

  const updateRestockAmount = (id: string, amt: number) => {
    setRestockAmounts((s) => {
      const next = { ...s, [id]: amt };
      console.log('restockAmounts (live)', next);
      return next;
    });

    setRestockPayloadMap((p) => {
      const next = {
        ...p,
        [id]: {
          variation_id: Number(id) || id,
          restock_amount: amt,
          order_ids: p[id]?.order_ids ?? [],
        },
      };
      console.log('restockPayloadMap (live)', next);
      return next;
    });
  };

  // derive customers from variation.waitlistOrders (populated from RPC)
  const customersFor = (variation: RestockVariation) => {
    const orders = variation.waitlistOrders;
    return (orders || []).map((o: any) => ({
      id: String(o.id ?? o.order_id ?? o.orderId ?? o.orderUUID ?? ""),
      name: o.customer_name ?? o.customer_name_snapshot ?? o.customerName ?? null,
      order: o.order_number ?? o.orderNumber ?? null,
      qty: o.quantity ?? o.quantity_needed ?? o.qty ?? 0,
      raw: o,
    }));
  };

  // normalize selected customer entries to string[] safely (handles legacy Set or other shapes)
  const ensureArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val as string[];
    if (val instanceof Set) return Array.from(val) as string[];
    try {
      // If iterable (e.g., Map keys), try Array.from
      if (typeof (val as any)[Symbol.iterator] === 'function') return Array.from(val as any) as string[];
    } catch (_) {}
    // If it's a plain object with string values, return its values
    if (typeof val === 'object') return Object.values(val).map((x) => String(x));
    return [String(val)];
  };

  const toggleCustomer = (variationId: string, customerId: string) => {
    setSelectedCustomers((s) => {
      const copy = { ...s } as Record<string, string[]>;
      const list = copy[variationId] ? [...copy[variationId]] : [];
      const idx = list.indexOf(customerId);
      if (idx >= 0) {
        list.splice(idx, 1);
        // clear any error for this variation when user unchecks
        setSelectionErrors((e) => ({ ...e, [variationId]: undefined }));
      } else {
        const v = rows.find((r) => r.id === variationId);
        const available = Number(v?.currentQty ?? 0) + Number(restockAmounts[variationId] ?? 0);
        if (list.length >= available) {
          // can't select more than available
          setSelectionErrors((e) => ({ ...e, [variationId]: `已達庫存上限：${available}` }));
          return s;
        }
        list.push(customerId);
        setSelectionErrors((e) => ({ ...e, [variationId]: undefined }));
      }
      copy[variationId] = list;
      return copy;
    });
  };

  const computeAllocationPreview = () => {
    const out: Record<string, string[]> = {};
    for (const v of rows) {
      const selected = ensureArray(selectedCustomers[v.id]).slice();
      out[v.id] = selected;
    }
    setAllocationPreview(out);
  };

  const handleProcessRestock = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      console.log('restockPayloadMap', restockPayloadMap);
      console.log('allocationPreview', allocationPreview);
      const skuCode = rpcPayload?.sku_code ?? sku ?? null;
      const skuId = rpcPayload?.sku_id ?? rpcPayload?.SKU_ID ?? rpcPayload?.skuId ?? rpcPayload?.sku?.id ?? (Array.isArray(rpcPayload?.waitlist_orders) && rpcPayload.waitlist_orders[0]?.sku_id) ?? (rows[0]?.sku_id ?? null) ?? null;
      const payloadArray = Object.values(restockPayloadMap).map((it) => ({
        variation_id: Number(it.variation_id) || it.variation_id,
        restock_amount: Number(it.restock_amount ?? 0),
        // ensure order ids are strings (use normalized ids from selection)
        order_ids: (it.order_ids || []).map((x: any) => String(x)),
        // include SKU context so RPC can validate/update at SKU-level if needed
        sku_code: skuCode,
        sku_id: skuId,
      })).filter((it) => Number(it.restock_amount) > 0 || (it.order_ids && it.order_ids.length > 0));

      // send payload (may be a no-op list of variation ids when nothing selected)
      let payloadToSend = payloadArray;
      if (payloadArray.length === 0 && rows.length > 0) {
        payloadToSend = rows.map((r) => ({
          variation_id: Number(r.id) || r.variation_id || r.id,
          restock_amount: 0,
          order_ids: [],
          sku_code: rpcPayload?.sku_code ?? sku ?? null,
          sku_id: rpcPayload?.sku_id ?? null,
        }));
      }

      // debug log full payload sent to RPC and expose to UI debug panel
      console.log('processBulkRestock payloadToSend', payloadToSend);
      setLastPayloadToSend(payloadToSend);

      const data = await processBulkRestock(payloadToSend);
      // expose raw RPC result to debug panel
      setLastProcessResult(data);
      // map returned latest stock into our rows for the confirmation step
      try {
      let payloadResult: any = data;
      if (Array.isArray(data) && data.length > 0 && data[0].process_bulk_restock) payloadResult = data[0].process_bulk_restock;
      else if (data && data.process_bulk_restock) payloadResult = data.process_bulk_restock;

      if (Array.isArray(payloadResult)) {
          // Build a map of the RPC result by variation id for easy merging
          const resultMap: Record<string, any> = {};
          for (const it of payloadResult) {
            const vid = String(it.variation_id ?? it.variationId ?? it.id ?? "");
            resultMap[vid] = it;
          }

          setRows((prev) => prev.map((r) => {
            const res = resultMap[r.id];
            if (!res) return r;

            // Normalize returned fields (prefer explicit RPC names provided)
            const rawStock = res.raw_stock ?? res.rawStock ?? res.latest_stock ?? res.latestStock ?? res.current_stock ?? res.currentStock ?? res.currentQty ?? res.current_qty;
            const rawQuota = res.raw_quota ?? res.rawQuota ?? res.current_quota ?? res.currentQuota ?? res.latest_quota ?? res.quota;
            const calcStock = res.calculated_stock ?? res.calculatedStock ?? res.total_available ?? res.totalAvailable ?? rawStock;
            const remainingPreorder = res.remaining_preorder_spots ?? res.remainingPreorderSpots ?? res.remaining_preorder ?? res.remaining;

            return {
              ...r,
              size: res.size ?? r.size,
              color: res.color ?? r.color,
              sku_id: res.sku_id ?? res.skuId ?? r.sku_id,
              raw_quota: rawQuota !== undefined ? Number(rawQuota) : r.raw_quota,
              raw_stock: rawStock !== undefined ? Number(rawStock) : r.raw_stock,
              total_available: (res.total_available ?? res.totalAvailable) !== undefined ? Number(res.total_available ?? res.totalAvailable) : r.total_available,
              total_waitlist_orders: (res.total_waitlist_orders ?? res.totalWaitlistOrders) !== undefined ? Number(res.total_waitlist_orders ?? res.totalWaitlistOrders) : r.total_waitlist_orders,
              remaining_preorder_spots: remainingPreorder !== undefined ? Number(remainingPreorder) : r.remaining_preorder_spots,
              calculated_stock: calcStock !== undefined ? Number(calcStock) : (r.calculated_stock ?? r.current_stock ?? r.currentQty ?? 0),
              current_stock: rawStock !== undefined ? Number(rawStock) : r.current_stock,
              currentQty: rawStock !== undefined ? Number(rawStock) : r.currentQty,
              current_quota: rawQuota !== undefined ? Number(rawQuota) : r.current_quota,
            };
          }));
        }
      } catch (mapErr) {
        // non-fatal mapping error — log and continue to step 4
        // eslint-disable-next-line no-console
        console.error('process_bulk_restock mapping error', mapErr);
      }

      // proceed to confirmation step on success
      setStep(4);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("process_bulk_restock error:", err);
      // minimal user feedback
      // eslint-disable-next-line no-alert
      alert("補貨處理失敗，請查看紀錄");
    } finally {
      setProcessing(false);
    }
  };

  // Build payload array from current restockPayloadMap (used for preview/debug)
  const buildPayloadPreview = () => {
    const skuCode = rpcPayload?.sku_code ?? sku ?? null;
    const skuId = rpcPayload?.sku_id ?? rpcPayload?.SKU_ID ?? rpcPayload?.skuId ?? rpcPayload?.sku?.id ?? (Array.isArray(rpcPayload?.waitlist_orders) && rpcPayload.waitlist_orders[0]?.sku_id) ?? (rows[0]?.sku_id ?? null) ?? null;
    const arr = Object.values(restockPayloadMap).map((it) => ({
      variation_id: Number(it.variation_id) || it.variation_id,
      restock_amount: Number(it.restock_amount ?? 0),
      order_ids: (it.order_ids || []).map((x: any) => String(x)),
      sku_code: skuCode,
      sku_id: skuId,
    })).filter((it) => Number(it.restock_amount) > 0 || (it.order_ids && it.order_ids.length > 0));

    // if empty, provide a no-op list reflecting current rows so RPC receives consistent shape
    if (arr.length === 0 && rows.length > 0) {
      return rows.map((r) => ({ variation_id: Number(r.id) || r.variation_id || r.id, restock_amount: 0, order_ids: [], sku_code: rpcPayload?.sku_code ?? sku ?? null, sku_id: rpcPayload?.sku_id ?? null }));
    }
    return arr;
  };

  // Keep payload preview updated for debug panel so it isn't null before submit
  useEffect(() => {
    try {
      const preview = buildPayloadPreview();
      setLastPayloadToSend(preview.length > 0 ? preview : null);
      console.log('payload preview updated', preview);
    } catch (e) {
      console.error('error building payload preview', e);
      setLastPayloadToSend(null);
    }
  }, [restockPayloadMap, rows, rpcPayload, restockAmounts]);

  useEffect(() => computeAllocationPreview(), [selectedCustomers, rows]);

  // debug: log rows when showing final confirmation (avoids logging in JSX)
  useEffect(() => {
    if (step === 4) console.log('restock-wizard step4 rows', rows);
  }, [step, rows]);

  const autoAssignAll = () => {
    const out: Record<string, string[]> = {};
    for (const v of rows) {
      const custs = customersFor(v).map((c) => c.id);
      const available = Number(v.currentQty ?? 0) + Number(restockAmounts[v.id] ?? 0);
      out[v.id] = custs.slice(0, available);
    }
    setSelectedCustomers(out);
  };

  // helpers for filtering variations that have waitlist/orders
  const getFilteredIndices = () => rows.map((_, i) => i).filter((i) => (rows[i].waitlist ?? 0) > 0 || (rows[i].waitlistOrders?.length ?? 0) > 0);

  const goToStep2 = () => {
    const list = getFilteredIndices();
    if (list.length > 0) setSelectedVariationIndex(list[0]);
    // initialize payload map for all variations based on current restockAmounts
    setRestockPayloadMap(() => {
      const out: Record<string, { variation_id: number | string; restock_amount: number; order_ids: string[] }> = {};
      for (const v of rows) {
        out[v.id] = {
          variation_id: Number(v.id) || v.id,
          restock_amount: Number(restockAmounts[v.id] ?? 0),
          order_ids: allocationPreview[v.id] ?? [],
        };
      }
      return out;
    });
    setStep(2);
  };

  // keep payload order_ids in sync with allocationPreview (when user selects customers)
  useEffect(() => {
    setRestockPayloadMap((prev) => {
      const copy = { ...prev };
      for (const vid of Object.keys(allocationPreview)) {
        const existing = copy[vid] ?? { variation_id: Number(vid) || vid, restock_amount: Number(restockAmounts[vid] ?? 0), order_ids: [] };
        copy[vid] = { ...existing, order_ids: allocationPreview[vid] ?? [] };
      }
      return copy;
    });
  }, [allocationPreview, restockAmounts]);

  useEffect(() => {
    console.log('restockPayloadMap (updated)', restockPayloadMap);
    
  }, [restockPayloadMap, allocationPreview, selectedCustomers]);

  const prevFiltered = () => {
    const list = getFilteredIndices();
    if (list.length === 0) return;
    const idx = list.indexOf(selectedVariationIndex);
    if (idx <= 0) setSelectedVariationIndex(list[0]);
    else setSelectedVariationIndex(list[idx - 1]);
  };

  const nextFiltered = () => {
    const list = getFilteredIndices();
    if (list.length === 0) return;
    const idx = list.indexOf(selectedVariationIndex);
    if (idx === -1) setSelectedVariationIndex(list[0]);
    else if (idx >= list.length - 1) setSelectedVariationIndex(list[list.length - 1]);
    else setSelectedVariationIndex(list[idx + 1]);
  };

  // prepared filtered indices + current position for rendering controls
  const filteredIndices = getFilteredIndices();
  const filteredPos = filteredIndices.indexOf(selectedVariationIndex);

  const selectedRow = rows[selectedVariationIndex] ?? null;
  const selectedCurrent = Number(selectedRow?.currentQty ?? 0);
  const selectedRestockAmount = Number(restockAmounts[selectedRow?.id ?? ""] ?? 0);
  const selectedCombined = selectedCurrent + selectedRestockAmount;

  const availableFor = (variationId: string) => {
    const v = rows.find((r) => r.id === variationId);
    return Number(v?.currentQty ?? 0) + Number(restockAmounts[variationId] ?? 0);
  };

  const isAllSelectedFor = (variationId: string) => {
    const fallback: RestockVariation = { variation_id: Number(variationId), id: variationId, size: "", color: "", waitlist: 0, current_stock: 0, current_quota: 0, currentQty: 0 } as RestockVariation;
    const custs = customersFor(rows.find((r) => r.id === variationId) ?? fallback).map((c) => c.id);
    const available = availableFor(variationId);
    const sel = ensureArray(selectedCustomers[variationId]);
    if (available === 0) return false;
    return sel.length > 0 && sel.length >= Math.min(custs.length, available) && custs.length > 0;
  };

  const toggleSelectAllFor = (variationId: string) => {
    const fallback: RestockVariation = { variation_id: Number(variationId), id: variationId, size: "", color: "", waitlist: 0, current_stock: 0, current_quota: 0, currentQty: 0 } as RestockVariation;
    const custs = customersFor(rows.find((r) => r.id === variationId) ?? fallback).map((c) => c.id);
    const available = availableFor(variationId);
    if (available === 0) {
      setSelectionErrors((e) => ({ ...e, [variationId]: `已達庫存上限：${available}` }));
      return;
    }
    const sel = ensureArray(selectedCustomers[variationId]);
    if (sel.length >= Math.min(custs.length, available)) {
      setSelectedCustomers((s) => ({ ...s, [variationId]: [] }));
      setSelectionErrors((e) => ({ ...e, [variationId]: undefined }));
    } else {
      const toSelect = custs.slice(0, available);
      setSelectedCustomers((s) => ({ ...s, [variationId]: toSelect }));
      setSelectionErrors((e) => ({ ...e, [variationId]: undefined }));
    }
  };

  // variations without waitlist/orders or allocations (used to hide empty section)
  const simpleRows = rows.filter((v) => (v.waitlistOrders?.length ?? 0) === 0 && (allocationPreview[v.id]?.length ?? 0) === 0);

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <AlertDialogContent className="relative max-w-[400px] max-h-[90vh] p-6 rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xs text-center">補貨明細</AlertDialogTitle>
          <div className="flex items-center justify-between mb-4">
            {step > 1 && step !== 4 && (
              <Button size="icon-sm" variant="ghost" className="absolute top-2 left-2 p-0" aria-label="Back" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </Button>
            )}
            
            <div className="ml-4 text-right">
              <button
                onClick={handleClose}
                aria-label="Close"
                className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-100 text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </AlertDialogHeader>

        {loadingData && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <Spinner className="h-10 w-10 text-gray-600" />
            <div className="text-sm text-gray-600 mt-3">載入中...</div>
          </div>
        )}

        <div className="space-y-4">
          {step === 1 && (
            <div className="flex flex-col gap-9 max-w-[400px] h-[50vh]  mx-auto">
              <SkuSummary sku={sku} rows={rows} preview={previewImage} totalWaitlistOrdersCount={rpcPayload?.total_waitlist_orders_count} onPreviewClick={() => setPreviewOpen(true)} />
              {rows.length === 0 ? (
                <EmptyWidget title="找不到變體" subtitle="目前沒有可顯示的變體資料。" />
              ) : (
                <div className="h-full">
                  <table className="w-full min-h-full text-sm">
                    <thead>
                      <tr className="text-[9px] text-gray-500">
                        <th className="text-center">尺寸</th>
                        <th className="text-center">顏色</th>
                        <th className="text-center">庫存</th>
                        
                        <th className="text-center">剩餘配額</th>
                       
                        
                        
                        <th className="text-center">候補數量(件)</th>
                         <th className="text-center">番貨數量</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t py-2">
                          <td className="py-3 text-[10px] text-center">{r.size}</td>
                          <td className="py-3 text-[10px] text-center">{r.color}</td>
                          <td className="py-3 text-[10px] text-center">{r.calculated_stock}</td>
                          
                          <td className="py-3 text-[10px] text-center">{r.remaining_preorder_spots ?? r.current_quota ?? '-'}</td>
                          
                         
                          
                         
                          <td className="py-3 text-[10px] text-center">{r.waitlist_qty}</td>
                           <td className="py-1 text-center">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="w-9 h-7 text-[10px] text-center"
                              value={String(restockAmounts[r.id] ?? 0)}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, "");
                                updateRestockAmount(r.id, v === "" ? 0 : Number(v));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex justify-center">
                <Button size="sm" className="bg-[#C4A59D] text-white text-xs h-[24px]" onClick={goToStep2}>下一步</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className=" max-w-[400px] h-[50vh]  mx-auto">
              <SkuSummary sku={sku} rows={rows} preview={previewImage} totalWaitlistOrdersCount={rpcPayload?.total_waitlist_orders_count} onPreviewClick={() => setPreviewOpen(true)}>
                {filteredIndices.length > 0 && (
                  <div className="flex h-[24px]">
                    <Button size="sm" variant="outline" className="text-xs h-[29px]" onClick={autoAssignAll}>自動分配所有變體</Button>
                  </div>
                )}
              </SkuSummary>
              {filteredIndices.length > 0 && (
                <div className="flex flex-col items-center justify-center mb-4 mt-4">
                  <div className="text-[10px] font-semibold text-center">第 {selectedVariationIndex + 1} / {rows.length} 個變體 (只顯示有訂單的變體)</div>
                  <div className="mt-2 flex items-center justify-center">
                    <div className="w-8 flex items-center justify-center">
                      {filteredPos > 0 ? (
                        <Button size="icon-sm" variant="ghost" className="p-0" aria-label="Previous variation" onClick={prevFiltered}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                          </svg>
                        </Button>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>

                    <div className="mx-2">
                      <div className="text-[10px] px-3 py-1 bg-gray-100 rounded-full text-center">{rows[selectedVariationIndex].size} | {rows[selectedVariationIndex].color}</div>
                    </div>

                    <div className="w-8 flex items-center justify-center">
                      {filteredPos >= 0 && filteredPos < filteredIndices.length - 1 ? (
                        <Button size="icon-sm" variant="ghost" className="p-0" aria-label="Next variation" onClick={nextFiltered}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                          </svg>
                        </Button>
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {customersFor(rows[selectedVariationIndex]).length === 0 ? (
                <EmptyWidget title="沒有候補訂單" subtitle="如單純補貨,請按下一步。" />
              ) : (
                <div className="bg-white p-4 space-y-3">
                  <div className="flex items-baseline gap-3">
                    <div className="text-[10px] text-gray-500">當前庫存: <span className="font-bold text-[#C4A59D]">{selectedCombined} 件</span></div>
                    <div className="text-[10px] text-gray-400">(庫存 {selectedCurrent} + 補貨 {selectedRestockAmount})</div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isAllSelectedFor(rows[selectedVariationIndex].id)}
                        disabled={availableFor(rows[selectedVariationIndex].id) === 0}
                        onCheckedChange={() => toggleSelectAllFor(rows[selectedVariationIndex].id)}
                      />
                     <div className="text-xs">全選</div>
                    </div>
                    <div className="text-[9px]">數量</div>
                  </div>

                  <div className="space-y-2 divide-y divide-gray-200">
                    {
                      (() => {
                        const varId = rows[selectedVariationIndex].id;
                        const available = Number(rows[selectedVariationIndex].currentQty ?? 0) + Number(restockAmounts[varId] ?? 0);
                        const selectedCount = ensureArray(selectedCustomers[varId]).length;
                        return (
                          <>
                            {customersFor(rows[selectedVariationIndex]).map((c) => {
                              const checked = ensureArray(selectedCustomers[varId]).includes(c.id);
                              const disabled = !checked && selectedCount >= available && available > 0 ? true : (!checked && available === 0 ? true : false);
                              return (
                                <div
                                  key={c.id}
                                  className={` flex justify-between p-3  ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => { if (!disabled) toggleCustomer(varId, c.id); }}
                                  onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                                      e.preventDefault();
                                      toggleCustomer(varId, c.id);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3 ">
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => { if (!disabled) toggleCustomer(varId, c.id); }} />
                                    </div>
                                    <div>
                                       <div className="flex gap-2 ">
                                      <div className="text-xs font-semibold">{c.name} |</div>
                                   <div className="flex items-center gap-1 w-[140px">
                                      <div className="text-[9px]  text-gray-500">訂單#</div>
                                      <div className="text-xs font-semibold">{c.order}</div>
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                  <div className="text-xs font-medium text-gray-700">{c.qty ?? ""}</div>
                                </div>
                              );
                            })}
                            {selectionErrors[varId] && (
                              <div className="text-xs text-red-600 mt-2">{selectionErrors[varId]}</div>
                            )}
                          </>
                        );
                      })()
                    }
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-center">
                <Button size="sm" className="bg-[#C4A59D] text-white text-xs h-[24px]" onClick={() => setStep(3)}>下一步</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-[400px] h-[50vh]  mx-auto">
              <SkuSummary sku={sku} rows={rows} preview={previewImage} totalWaitlistOrdersCount={rpcPayload?.total_waitlist_orders_count} onPreviewClick={() => setPreviewOpen(true)} />
              <div className="max-h-[90vh] overflow-y-auto">
                {rows.some((v) => (restockPayloadMap[v.id]?.order_ids?.length ?? 0) > 0 || (allocationPreview[v.id]?.length ?? 0) > 0) && (
                  <>
                    <div className="text-xs font-semibold mt-4 text-left">分配名單</div>
                    {/* Variations that have orders/waitlist */}
                    <div className="rounded p-3 divide-y divide-gray-200">
                      {rows
                        .filter((v) => (restockPayloadMap[v.id]?.order_ids?.length ?? 0) > 0 || (allocationPreview[v.id]?.length ?? 0) > 0)
                        .map((v) => {
                          const payloadEntry = restockPayloadMap[v.id] ?? { variation_id: v.id, restock_amount: 0, order_ids: allocationPreview[v.id] ?? [] };
                          return (
                            <div key={v.id} className="py-3">
                              <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-start gap-2">
                                    <div>
                                      <div className="font-semibold text-xs">{v.size} | {v.color}</div>
                                      
                                    </div>
                                    <div className="text-[11px] text-gray-500">總庫存: <span className="text-xs text-[#C4A59D]">{availableFor(v.id)} ( {v.currentQty} + <span className="text-xs text-[#C4A59D]">{payloadEntry.restock_amount}補貨)</span> </span></div>
                                  </div>
                                <div className="text-xs text-gray-500 ">共{v.waitlist}件</div>
                              </div>

                              <div className="divide-y divide-gray-200 mt-2">
                                {(payloadEntry.order_ids ?? []).length > 0 ? (
                                  (payloadEntry.order_ids ?? []).map((oid: string) => {
                                    const order = v.waitlistOrders?.find((o: any) => String(o.id) === String(oid));
                                    const displayName = order?.customer_name;
                                    const displayOrderNumber = order?.order_number;
                                    const displayQty = order?.quantity;
                                    return (
                                      <div key={oid} className="flex items-center py-2 px-2 gap-4">
                                        <div className="flex-1 text-xs">{displayName}</div>
                                        <div className="flex-1 text-xs text-gray-500">{displayOrderNumber}</div>
                                        <div className="w-12 text-right text-xs">x {displayQty}</div>
                                       
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-xs text-gray-500 py-2">未選擇訂單</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}

                {simpleRows.length > 0 && (
                  <>
                    <div className=" my-3" />
                    <div>
                      <div className="text-xs font-semibold mb-2">單純補貨</div>
                      <div className="p-3 divide-y divide-gray-200">
                        <div className="flex items-center text-[9px] text-gray-500 font-semibold mb-2">
                          <div className="w-2/4">變體</div>
                          <div className="w-2/4 flex justify-between">
                            <div className="w-1/4 text-right">剩餘配額</div>
                            <div className="w-1/4 text-right">庫存</div>
                            <div className="w-1/4 text-right">補貨</div>
                            <div className="w-1/4 text-right">總供應量</div>
                          </div>
                        </div>

                        {simpleRows.map((v) => (
                          <div key={v.id} className="flex items-start py-2">
                            <div className="text-[10px] w-2/4">
                              <div>{v.size} | {v.color}</div>
                            </div>
                            <div className="text-[10px] text-gray-500 w-2/4 flex justify-between">
                              <div className="w-1/4 text-right">{v.remaining_preorder_spots}</div>
                              <div className="w-1/4 text-right">{v.calculated_stock}</div>
                              <div className="w-1/4 text-right">{restockAmounts[v.id] ?? 0}</div>
                              <div className="w-1/4 text-right">{Number(restockAmounts[v.id] ?? 0) + Number(v.calculated_stock) + Number(v.remaining_preorder_spots)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <Button size="sm" className="bg-[#C4A59D] text-white text-xs h-[24px]" onClick={handleProcessRestock} disabled={processing}>
                  {processing ? "處理中..." : "完成"}
                </Button>
              </div>
              {/* debug UI removed */}
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8  max-w-[400px] h-[50vh]  mx-auto">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-6">
                <svg className="w-9 h-9 text-[#C4A59D]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div className="text-md font-bold mb-2">完成補貨</div>
              <div className="text-[10px] text-gray-500 mb-9">分配訂單後，剩下的補貨已加入庫存</div>

                    
                  <div className="inline-block text-left w-56">
                    {rows.length === 0 ? (
                      <EmptyWidget title="無補貨變體" subtitle="沒有變體資料可顯示。" />
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[9px] text-gray-500">
                            <th className="text-left">變體</th>
                            <th className="text-right">剩餘配額</th>
                            <th className="text-right">最新庫存</th>
                            <th className="text-right">總供應量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                                <td className="py-2 text-[10px]">{r.size} | {r.color}</td>
                                <td className="py-2 text-right">
                                  <div className="text-[10px] text-gray-700">{r.remaining_preorder_spots}</div>
                                </td>
                                <td className="py-2 text-right">
                                  <div className="text-[10px]">{Number(r.calculated_stock)}</div>
                                </td>
                                <td className="py-2 text-right font-bold">
                                  <div className="text-[10px]">{Number(r.remaining_preorder_spots) + Number( r.calculated_stock)}</div>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                 

              <div className="mt-6">
                <Button size="sm" className="bg-[#C4A59D] text-white text-xs h-[24px]" onClick={() => { handleClose(); }}>發送到貨通知</Button>
              </div>
            </div>
          )}
        </div>

        {/* debug panel removed */}
        <ImageFullscreen src={previewImage || ''} alt={sku} open={previewOpen} onClose={() => setPreviewOpen(false)} />
        <div className="mt-4 space-y-2">
          <div className="flex gap-3 items-center">
            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => setShowRpcDebug((s) => !s)}
            >
              {showRpcDebug ? '隱藏 RPC 輸出' : '顯示 RPC 輸出'}
            </button>

            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => setShowPayloadDebug((s) => !s)}
            >
              {showPayloadDebug ? '隱藏 payloadToSend' : '顯示 payloadToSend'}
            </button>

            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => setShowProcessResult((s) => !s)}
            >
              {showProcessResult ? '隱藏 processBulkRestock 回傳' : '顯示 processBulkRestock 回傳'}
            </button>
          </div>

          {showRpcDebug && (
            <div className="mt-2 max-h-64 overflow-auto text-xs bg-gray-100 p-2 rounded">
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(rpcPayload, null, 2)}</pre>
            </div>
          )}

          {showPayloadDebug && (
            <div className="mt-2 max-h-64 overflow-auto text-xs bg-gray-100 p-2 rounded">
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(lastPayloadToSend, null, 2)}</pre>
            </div>
          )}

            {showProcessResult && (
              <div className="mt-2 max-h-64 overflow-auto text-xs bg-gray-100 p-2 rounded">
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(lastProcessResult, null, 2)}</pre>
              </div>
            )}
        </div>

        <AlertDialogFooter />
      </AlertDialogContent>
    </AlertDialog>
  );
}
