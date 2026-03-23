"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import ImageFullscreen from "./ImageFullscreen";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import OrderDetailsModalSidebar from "./order-details-modal-sidebar";
import RestockWizard from "./restock-wizard";

interface Props {
  product: Product | null;
}

type OrderItem = {
  id: string;
  orderNumber: string;
  customerName?: string;
  quantity?: number;
  itemsNeeded?: number;
  totalItems?: number;
  whatsapp?: string;
  customerId?: string;
};

type VariationBreakdown = {
  variation_id: number;
  size_name: string;
  color: string;
  needed: number;
  thumbnail?: string;
};

export default function RestockSidebar({ product }: Props) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [totalWaitlistCount, setTotalWaitlistCount] = useState<number>(0);
  const [variations, setVariations] = useState<VariationBreakdown[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  const [fullscreenAlt, setFullscreenAlt] = useState<string>("");

  useEffect(() => {
    if (!product) return;
    fetchSkuRestockDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const fetchSkuRestockDetails = async () => {
    setLoading(true);
    try {
      const skuId = parseInt(String(product?.id || ""));
      const { data, error } = await supabase.rpc("get_sku_restock_details", { p_sku_id: skuId });
      if (error) throw error;

      let payload: any = data;
      if (Array.isArray(data) && data.length > 0 && data[0].get_sku_restock_details) payload = data[0].get_sku_restock_details;
      else if (data.get_sku_restock_details) payload = data.get_sku_restock_details;

      const variationList: VariationBreakdown[] = (payload.variation_breakdown || []).map((v: any) => ({
        variation_id: v.variation_id,
        size_name: v.size_name,
        color: v.color,
        needed: v.needed ?? 0,
        thumbnail: v.thumbnail,
      }));

      const mappedOrders: OrderItem[] = (payload.related_orders || []).map((o: any, idx: number) => ({
        id: (o.order_number || o.order_no || String(idx)),
        orderNumber: o.order_number || o.order_no || String(idx),
        customerName: o.customer_name || o.name || '',
        itemsNeeded: o.items_needed_for_this_sku ?? o.items_needed ?? 0,
        quantity: o.items_needed_for_this_sku ?? o.items_needed ?? 0,
        totalItems: o.total_items_in_order ?? o.total_items ?? 0,
        whatsapp: o.whatsapp,
        customerId: o.customer_id,
      }));

      setVariations(variationList);
      setOrders(mappedOrders);
      const total = variationList.reduce((s, v) => s + (v.needed || 0), 0);
      setTotalWaitlistCount(total);
    } catch (e) {
      console.error("fetchSkuRestockDetails error", e);
      setVariations([]);
      setOrders([]);
      setTotalWaitlistCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white min-w-0 box-border">
      <SheetHeader>
        <div className="flex flex-row items-start gap-6 pt-4">
          <div
            className="w-36 h-56 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"
            role={product ? "button" : undefined}
            tabIndex={product ? 0 : undefined}
            onClick={() => {
              if (!product) return;
              const src = product.images?.[0] || '/placeholder.svg';
              setFullscreenSrc(src);
              setFullscreenAlt(product.name || "");
              setFullscreenOpen(true);
            }}
            onKeyDown={(e) => {
              if (!product) return;
              if (e.key === 'Enter') {
                const src = product.images?.[0] || '/placeholder.svg';
                setFullscreenSrc(src);
                setFullscreenAlt(product.name || "");
                setFullscreenOpen(true);
              }
            }}
          >
            {product ? (
              <Image
                src={product.images?.[0] || '/placeholder.svg'}
                alt={product.name}
                width={320}
                height={480}
                sizes="(max-width: 640px) 100vw, 144px"
                className="object-cover w-full h-full max-w-full"
              />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-md font-bold">{product ? product.sku : "-"}</SheetTitle>
                <div className="mt-2 text-xs text-gray-700">候補總數：</div>
                <div className="text-sm font-extrabold text-[#111] mt-1">{totalWaitlistCount} 件</div>
              </div>
            </div>

            <div className="mt-4 max-h-36 overflow-y-auto pr-2">
              {variations.length === 0 && (
                <div className="text-sm text-gray-500">沒有變體資料</div>
              )}

              {variations.map((v) => (
                <div key={v.variation_id} className="flex items-center justify-between text-sm text-gray-800 py-1">
                  <div className="flex items-center gap-1">
                    
                    <div>{v.size_name} | {v.color}</div>
                  </div>
                  <div className="font-medium">x{v.needed ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="p-4">
        <Button
          className="w-full rounded-full bg-gray-200 text-black"
          onClick={() => setWizardOpen(true)}
        >
          補貨
        </Button>
      </div>

      <Separator />

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-4 text-sm font-medium">相關訂單</div>

        {loading && <div className="text-sm text-gray-500">載入中…</div>}
        {!loading && orders.length === 0 && <div className="text-sm text-gray-500">沒有候補訂單</div>}

        <div className="space-y-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="relative bg-white border-1 border-gray-200 rounded-2xl p-4 sm:p-4 cursor-pointer hover:shadow"
              role="button"
              tabIndex={0}
              onClick={() => { setSelectedOrder(o); setOrderModalOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedOrder(o); setOrderModalOpen(true); } }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  
                  <div className="text-md text-gray-700 mt-1">{o.customerName}</div>
                  {o.whatsapp && <div className="text-xs text-gray-500 mt-1">聯絡電話: {o.whatsapp}</div>}
                 
                  <div className="text-xs text-gray-700 mt-2">共{o.totalItems ?? o.quantity ?? 1} 件商品候補中</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <OrderDetailsModalSidebar
        open={orderModalOpen}
        onOpenChange={(v) => {
          setOrderModalOpen(v);
          if (!v) {
            setSelectedOrder(null);
            fetchSkuRestockDetails();
          }
        }}
        customerId={selectedOrder?.customerId ?? null}
      />

      <RestockWizard
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          fetchSkuRestockDetails();
        }}
        sku={String(product?.id ?? "")}
      />

      <ImageFullscreen
        src={fullscreenSrc || ''}
        alt={fullscreenAlt}
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
      />
    </div>
  );
}
