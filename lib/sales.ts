export type Sale = {
  id: string;
  sku: string;
  amount: number; // quantity sold
  revenue?: number;
  timestamp: Date;
};

// Aggregate sales by month (YYYY-MM) and SKU
export function aggregateSalesByMonth(sales: Sale[]) {
  const byMonth = new Map<string, Map<string, { sku: string; amount: number; revenue: number }>>();

  for (const s of sales) {
    const y = s.timestamp.getFullYear();
    const m = String(s.timestamp.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    const skuMap = byMonth.get(key)!;
    const prev = skuMap.get(s.sku);
    if (!prev) skuMap.set(s.sku, { sku: s.sku, amount: s.amount, revenue: s.revenue ?? 0 });
    else {
      prev.amount += s.amount;
      prev.revenue += s.revenue ?? 0;
    }
  }

  // Convert to object form
  const out: { month: string; skus: { sku: string; amount: number; revenue: number }[] }[] = [];
  for (const [month, map] of Array.from(byMonth.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    out.push({ month, skus: Array.from(map.values()).sort((a, b) => b.amount - a.amount) });
  }
  return out;
}

export function monthTrend(sales: Sale[], sku: string) {
  // returns array of { month, amount }
  const map = new Map<string, number>();
  for (const s of sales) {
    if (s.sku !== sku) continue;
    const y = s.timestamp.getFullYear();
    const m = String(s.timestamp.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    map.set(key, (map.get(key) ?? 0) + s.amount);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([month, amount]) => ({ month, amount }));
}

// Lifetime trend for a SKU: aggregate by day (YYYY-MM-DD), sort chronologically,
// and return cumulative totals per date so charts can show the whole-life progression.
export function lifetimeTrend(sales: Sale[], sku: string) {
  const map = new Map<string, { date: string; amount: number; revenue: number }>();
  for (const s of sales) {
    if (s.sku !== sku) continue;
    const y = s.timestamp.getFullYear();
    const m = String(s.timestamp.getMonth() + 1).padStart(2, "0");
    const d = String(s.timestamp.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    const prev = map.get(key);
    if (!prev) map.set(key, { date: key, amount: s.amount, revenue: s.revenue ?? 0 });
    else {
      prev.amount += s.amount;
      prev.revenue += s.revenue ?? 0;
    }
  }

  const daily = Array.from(map.values()).sort((a, b) => a.date < b.date ? -1 : 1);

  // cumulative
  const out: { date: string; amount: number; revenue: number }[] = [];
  let runningAmount = 0;
  let runningRevenue = 0;
  for (const row of daily) {
    runningAmount += row.amount;
    runningRevenue += row.revenue ?? 0;
    out.push({ date: row.date, amount: runningAmount, revenue: runningRevenue });
  }
  return out;
}

export function monthlyTotals(sales: Sale[]) {
  const map = new Map<string, { month: string; amount: number; revenue: number }>();
  for (const s of sales) {
    const y = s.timestamp.getFullYear();
    const m = String(s.timestamp.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    const prev = map.get(key);
    if (!prev) map.set(key, { month: key, amount: s.amount, revenue: s.revenue ?? 0 });
    else {
      prev.amount += s.amount;
      prev.revenue += s.revenue ?? 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.month < b.month ? -1 : 1);
}
