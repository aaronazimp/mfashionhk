import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { Metadata, ResolvingMetadata } from "next";
import PaymentClient from "./payment-client";
import type { PaymentPageOrder } from "../../../lib/products";
import { getPaymentPageData } from "../../../lib/orderService";

// Ensure we have the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// NOTE: don't initialize the client at module import time — create it lazily inside the
// server function so missing env or network errors can be handled gracefully.

type Props = {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

async function getOrder(id: string): Promise<PaymentPageOrder | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !key) {
    console.warn("Supabase environment variables missing; cannot fetch orders in this environment.");
    return null;
  }

  // Create a Supabase client lazily so we don't initialize at module import time
  const supabase = createClient(url, key);

  

  // Call the server-side RPC which centralises payment-summary logic
  let rpcData: any = null;
  try {
    rpcData = await getPaymentPageData(id);
    console.log("Supabase RPC get_payment_page_data return:", rpcData);
  } catch (err: any) {
    console.warn("RPC get_payment_page_data error:", err);
    // Network / DNS or RPC errors surface here (fetch failed / ENOTFOUND / Postgres error)
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
  }

  // Normalize RPC result: Supabase may return an array wrapper or object
  let payload: any = rpcData;
  if (Array.isArray(payload)) {
    // Some RPC shapes return [{ get_order_payment_summary: { ... } }] or [ { ... } ]
    payload = payload[0] ?? null;
    if (payload && payload.get_payment_page_data) payload = payload.get_payment_page_data;
  }

  // If payload is a string, try parse JSON
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.warn('Failed to parse RPC JSON payload', e);
      return null;
    }
  }

  // If RPC returned a known error payload, treat as missing order
  // e.g. { error: "Transaction not found" }
  const rpcError =
    (payload && (payload.error || payload.message)) ||
    (payload && payload.get_payment_page_data && (payload.get_payment_page_data.error || payload.get_payment_page_data.message));
  if (typeof rpcError === 'string' && rpcError.includes('Transaction not found')) {
    console.warn('get_payment_page_data RPC returned Transaction not found for', id);
    return null;
  }

  if (!payload) {
    console.warn('Empty payload from get_payment_page_data');
    // Dev fallback: return a lightweight mock order to keep the page visible while DB RPC or grants are being fixed
    if (process.env.NODE_ENV !== 'production') {
      return {
        id: id,
        transaction_id: id,
        order_number: id,
        created_at: new Date().toISOString(),
        subtotal: 0,
        shipping_fee: 0,
        total_to_pay: 0,
        price: 0,
        status: 'pending',
        receipt_url: undefined,
        base64_image: undefined,
        whatsapp: undefined,
        payment_proof_url: undefined,
        payment_deadline: undefined,
        items_waitlist: [],
        items: [],
      } as PaymentPageOrder;
    }

    return null;
  }

  // Map RPC result into the `Order` shape expected by the client component.
  // Use the subtotal as the main `price`. Use the first "pay now" item for item-level fields where appropriate.
  const payNowGroups = payload.pay_now_groups || {};
  const itemsPayNow = Object.values(payNowGroups).flat() as any[];
  const first = itemsPayNow[0] ?? null;
  
  // Build items array from RPC rows so the client can render every line item
  const items = itemsPayNow.map((it: any) => ({
    id: it.id ?? `TXN-${payload.transaction_id}-${it.sku_code}`,
    sku: it.sku_code || "",
    price: Number(it.price ?? it.row_total ?? 0),
    quantity: Number(it.quantity ?? 1),
    variation: it.variation_snapshot || "",
    row_total: Number(it.row_total ?? (it.price ?? 0) * (it.quantity ?? 1)),
    sku_img_url: it.image_url ?? undefined,
    status: 'pay_now',
  }));

  // If no image URLs were provided by the RPC, attempt to resolve images from SKU master tables
  try {
    const skus = Array.from(new Set(items.map((i: any) => i.sku).filter(Boolean)));
    if (skus.length > 0) {
      // Query SKU_details with nested SKU_images to find candidate image URLs
      const { data: skuDetails, error: skuErr } = await supabase
        .from('SKU_details')
        .select('id,SKU,imageurl,SKU_images(imageurl, imageIndex)')
        .in('SKU', skus as string[]);

      if (!skuErr && Array.isArray(skuDetails)) {
        const imageBySku: Record<string, string> = {};
        skuDetails.forEach((row: any) => {
          const skuCode = row.SKU || row.sku || '';
          if (!skuCode) return;
          // Prefer explicit imageurl on SKU_details, else first SKU_images with lowest index
          if (row.imageurl) {
            imageBySku[skuCode] = row.imageurl;
            return;
          }
          if (Array.isArray(row.SKU_images) && row.SKU_images.length > 0) {
            const best = row.SKU_images.reduce((acc: any, cur: any) => {
              if (!acc) return cur;
              const ai = typeof acc.imageIndex === 'number' ? acc.imageIndex : 0;
              const ci = typeof cur.imageIndex === 'number' ? cur.imageIndex : 0;
              return ci < ai ? cur : acc;
            }, null);
            if (best && best.imageurl) imageBySku[skuCode] = best.imageurl;
          }
        });

        // Attach found images to items
        items.forEach((it: any) => {
          if (!it.sku_img_url && imageBySku[it.sku]) it.sku_img_url = imageBySku[it.sku];
        });
      }
    }
  } catch (e) {
    console.warn('Failed to resolve SKU images for order items', e);
  }

  const mapped: PaymentPageOrder = {
    id: payload.transaction_id || id,
    transaction_id: payload.transaction_id || id,
    order_number: payload.transaction_id || id,
    created_at: new Date().toISOString(),
    sku: first?.sku_code || payload.transaction_id || "",
    // Prefer the RPC `total_to_pay` as the main payable amount
    price: Number(payload.total_to_pay ?? payload.subtotal ?? 0),
    subtotal: Number(payload.subtotal ?? 0),
    shipping_fee: Number(payload.shipping_fee ?? 0),
    total_to_pay: Number(payload.total_to_pay ?? payload.subtotal ?? 0),
    // Join multiple item SKUs for a concise product name (e.g. "M30, M44")
    product_name: items.map((i: any) => i.sku).filter(Boolean).join(', ') || first?.sku_code || "Order Items",
    customer_name: undefined,
    status: payload.status || 'pending',
    receipt_url: undefined,
    // Prefer image provided by RPC (`image_url`) as top-level image
    sku_img_url: first?.sku_img_url ?? first?.image_url ?? undefined,
    base64_image: undefined,
    sku_code_snapshot: first?.sku_code,
    variation_snapshot: first?.variation_snapshot,
    quantity: items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || first?.quantity,
    whatsapp: payload.whatsapp,
    payment_proof_url: undefined,
    payment_deadline: payload.payment_deadline,
    deadline: payload.payment_deadline,
    items_waitlist: payload.items_waitlist ?? [],
    pay_now_groups: payload.pay_now_groups ?? {},
    items,
  };

  return mapped;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await Promise.resolve(params as any);
  const order = await getOrder(id);

  if (!order) {
    return {
      title: "找不到訂單",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const ogUrl = new URL(`${baseUrl}/api/og/invoice`);
  ogUrl.searchParams.set("sku", order.sku || "");
  ogUrl.searchParams.set("price", order.price?.toString() || "0");
  ogUrl.searchParams.set("name", order.product_name || "Order");

  return {
    title: `支付 ${order.product_name} - HK$${order.price}`,
    description: `完成訂單 #${order.order_number || order.id.slice(0, 8).toUpperCase()} 的付款`,
    openGraph: {
      title: `發票: ${order.product_name}`,
      description: `總計: HK$${order.price}`,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${order.product_name} 的發票`,
        },
      ],
    },
  };
}

import DevClientCheck from "@/components/dev-client-check";
import OrderNotFoundDialog from '@/components/OrderNotFoundDialog'

export default async function PaymentPage({ params }: Props) {
  const { id } = await Promise.resolve(params as any);
  const order = await getOrder(id);

  if (!order) {
    return <OrderNotFoundDialog transactionId={id} />;
  }

  // Dev-only debug: render server order payload so we can confirm the server returned data
  return <PaymentClient order={order} />;
}
