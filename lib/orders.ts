export type Registration = {
  id: string;
  sku: string;
  skuId?: string;
  customerName: string;
  whatsapp: string;
  variation: string;
  timestamp: Date;
  status: "pending" | "in-stock" | "out-of-stock" | "completed" | "waitlist" | "confirmed" | "paid" | "verified" | "void";
  adminAction?: "confirm" | "out-of-stock";
  imageUrl?: string;
  skuDate?: string;
  paymentProofUrl?: string;
  reelsDeadline?: string;
};

// Helper to map DB response to Registration type
export function mapSupabaseOrderToRegistration(order: any): Registration {
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
    sku: order.sku_code_snapshot || "Unknown",
    skuId: order.sku_id,
    customerName: order.customer_name,
    whatsapp: order.whatsapp,
    variation: order.variation_snapshot || "",
    timestamp: new Date(order.created_at),
    status: status,
    imageUrl,
    skuDate: details?.SKU_date || "",
    reelsDeadline: details?.reels_deadline || undefined,
    paymentProofUrl: order.payment_proof_url || (status === 'paid' ? "https://placehold.co/100x100?text=Proof" : undefined),
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
      return r.sku.toLowerCase().includes(searchSku.trim().toLowerCase());
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
