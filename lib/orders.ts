export type Registration = {
  id: string;
  orderNumber: string;
  sku: string;
  skuId?: string;
  customerName: string;
  whatsapp: string;
  variation: string;
  variationId?: number;
  timestamp: Date;
  status: "pending" | "in-stock" | "out-of-stock" | "completed" | "waitlist" | "confirmed" | "paid" | "verified" | "void";
  adminAction?: "confirm" | "out-of-stock";
  imageUrl?: string;
  skuDate?: string;
  paymentProofUrl?: string;
  reelsDeadline?: string;
  price?: number;
};

// Helper to map DB response to Registration type
export function mapSupabaseOrderToRegistration(order: any): Registration {
  // Debug logging for variation_id issue
  const variationIdValue = order.variation_id;
  const variationIdNumber = variationIdValue ? Number(variationIdValue) : undefined;
  
  console.log('[Orders Mapping] Mapping order:', {
    orderId: order.id,
    variation_id: variationIdValue,
    variation_id_type: typeof variationIdValue,
    has_variation_id: 'variation_id' in order,
    computed_variationId: variationIdNumber,
    variation_snapshot: order.variation_snapshot,
    sku_code_snapshot: order.sku_code_snapshot
  });
  
  if (!variationIdNumber) {
    // Lower-severity logging: variation_id can legitimately be null for some legacy rows.
    // Keep this as debug to avoid alarming users when toggling UI state.
    console.debug('[Orders Mapping] variation_id missing or invalid for order (this may be expected for legacy rows):', {
      orderId: order.id,
      variation_id: variationIdValue,
      type: typeof variationIdValue,
      allKeys: Object.keys(order),
      variationRelatedKeys: Object.keys(order).filter(k => k.toLowerCase().includes('variation'))
    });
  }
  
  let status: Registration["status"] = "pending";
  const s = (order.status || "").toLowerCase().trim();
  
  if (s === "confirmed") status = "confirmed";
  else if (s === "in-stock" || s === "in_stock") status = "in-stock";
  else if (s === "out-of-stock" || s === "out_of_stock") status = "out-of-stock";
  else if (s === "completed") status = "completed";
  else if (s === "waitlist") status = "waitlist";
  else if (s === "paid") status = "paid";
  else if (s === "verified") status = "verified";
  else if (s === "void") status = "void";

  let imageUrl = "";
  const details = order.SKU_details;
  if (details && Array.isArray(details.SKU_images)) {
    const img = details.SKU_images.find((i: any) => i.imageIndex === 0);
    if (img) imageUrl = img.imageurl;
    else if (details.SKU_images.length > 0) imageUrl = details.SKU_images[0].imageurl;
  }

  return {
    id: order.id,
    orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
    sku: order.sku_code_snapshot || "Unknown",
    skuId: order.sku_id,
    customerName: order.customer_name,
    whatsapp: order.whatsapp,
    variation: order.variation_snapshot || "",
    variationId: variationIdNumber,
    timestamp: new Date(order.created_at),
    status: status,
    imageUrl,
    skuDate: details?.SKU_date || "",
    reelsDeadline: details?.reels_deadline || undefined,
    paymentProofUrl: order.payment_proof_url || (status === 'paid' ? "https://placehold.co/100x100?text=Proof" : undefined),
    price: order.price,
  };
}

export type Group = {
  sku: string;
  items: Registration[];
  latest: Date;
};

export function groupAndSortRegistrations(
  registrations: Registration[],
  options?: { view?: "all" | "pending" | "completed"; searchSku?: string }
): Group[] {
  const view = options?.view ?? "all";
  const searchSku = options?.searchSku ?? "";

  const filtered = registrations.filter((r) => {
    if (view === "pending") {
      if (!(r.status === "pending" || r.status === "in-stock" || r.status === "out-of-stock" || r.status === "waitlist" || r.status === "confirmed" || r.status === "paid")) return false;
    } else if (view === "completed") {
      if (!(r.status === "completed" || r.status === "verified" || r.status === "void")) return false;
    }

    if (searchSku.trim()) {
      const term = searchSku.trim().toLowerCase();
      // Expanded Search Scope
      return (
        r.sku.toLowerCase().includes(term) ||
        (r.customerName && r.customerName.toLowerCase().includes(term)) ||
        (r.whatsapp && r.whatsapp.includes(term)) ||
        (r.orderNumber && r.orderNumber.toLowerCase().includes(term))
      );
    }

    return true;
  });

  const map = new Map<string, Registration[]>();
  for (const r of filtered) {
    if (!map.has(r.sku)) map.set(r.sku, []);
    map.get(r.sku)!.push(r);
  }

  const arr: Group[] = Array.from(map.entries()).map(([sku, items]) => {
    const latest = items.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).timestamp;
    items.sort((x, y) => y.timestamp.getTime() - x.timestamp.getTime());
    return { sku, items, latest };
  });

  arr.sort((a, b) => b.latest.getTime() - a.latest.getTime());
  return arr;
}

// Shared types for order modals / RPC responses
export type Item = {
  price?: number
  status?: string
  item_id?: string
  line_item_id?: string
  sku_id?: number
  variation_id?: number
  remark?: string | null
  remarks?: string | null
  quantity?: number
  sku_code?: string
  thumbnail?: string
  variation?: string
}

export type Order = {
  order_number?: string
  order_total_items?: number
  order_total_amount?: number
  order_total?: number
  order_status?: string
  transaction_id?: string
  items?: Item[]
}

export type RpcResponse = {
  orders?: Order[]
  whatsapp?: string
  customer_name?: string
  grand_total_items?: number
  grand_total_amount?: number
  total_orders_count?: number
  summary?: {
    status_counts?: Record<string, { items?: number; orders?: number; actions?: number }>
    all_items_count?: number
    all_orders_count?: number
    all_actions_count?: number
  }
  status_priority?: string[]
}
