"use client";

import React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChartContainer } from "@/components/ui/chart";
import * as Recharts from "recharts";
import { monthlyTotals, lifetimeTrend, Sale } from "@/lib/sales";
import { ArrowLeft, TrendingUp, Calendar, DollarSign, Package, Trophy, BarChart3 } from "lucide-react";

// Mock sales generator for demonstration — replace with real API later
function generateMockSales(): Sale[] {
  // Use fixed date to ensure consistency between server and client
  const now = new Date('2026-01-30T00:00:00');
  const skus = ["R2026012401", "R2026012402", "R2026012403", "R2025120101"];
  const out: Sale[] = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Deterministic generation
    const sku = skus[i % skus.length];
    const amount = i % 4 === 0 ? (i % 2) + 1 : (i % 5) + 1;
    out.push({ 
      id: `${i}-${sku}`, 
      sku, 
      amount, 
      timestamp: d, 
      revenue: amount * (50 + (i * 37) % 100) 
    });
  }
  return out;
}

export default function BestSellersPage() {
  const sales = useMemo(() => generateMockSales(), []);
  // compute all-time top sellers
  const allTime = useMemo(() => {
    const map = new Map<string, { sku: string; amount: number; revenue: number }>();
    for (const s of sales) {
      const prev = map.get(s.sku);
      if (!prev) map.set(s.sku, { sku: s.sku, amount: s.amount, revenue: s.revenue ?? 0 });
      else {
        prev.amount += s.amount;
        prev.revenue += s.revenue ?? 0;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [sales]);

  const topAllTime = allTime.slice(0, 5);

  const [selectedSku, setSelectedSku] = useState<string | null>(topAllTime[0]?.sku ?? null);

  // tabs
  const [activeTab, setActiveTab] = useState<'totals' | 'sku'>('totals');

  // monthly range filter: '30d' | '3m' | '6m' | '1y'
  const [range, setRange] = useState<'30d' | '3m' | '6m' | '1y'>('3m');

  // when switching to sku tab, ensure selectedSku defaults to topAllTime[0]
  React.useEffect(() => {
    if (activeTab === 'sku' && !selectedSku) {
      setSelectedSku(topAllTime[0]?.sku ?? null);
    }
  }, [activeTab, selectedSku, topAllTime]);

  function cutoffDateFor(range: '30d' | '3m' | '6m' | '1y') {
    const now = new Date();
    const d = new Date(now.getTime());
    if (range === '30d') d.setDate(d.getDate() - 30);
    if (range === '3m') d.setDate(d.getDate() - 90);
    if (range === '6m') d.setDate(d.getDate() - 180);
    if (range === '1y') d.setDate(d.getDate() - 365);
    return d;
  }

  const totals = useMemo(() => monthlyTotals(sales), [sales]);

  const filteredSalesForRange = useMemo(() => {
    const cutoff = cutoffDateFor(range);
    return sales.filter((s) => s.timestamp >= cutoff);
  }, [sales, range]);

  const totalsForRange = useMemo(() => monthlyTotals(filteredSalesForRange), [filteredSalesForRange]);

  const totalsChartData = totalsForRange.map((t) => ({ month: t.month, amount: t.amount }));

  const summaryForRange = useMemo(() => {
    let units = 0;
    let revenue = 0;
    for (const s of filteredSalesForRange) {
      units += s.amount;
      revenue += s.revenue ?? 0;
    }
    return { units, revenue };
  }, [filteredSalesForRange]);

  const topSkusForRange = useMemo(() => {
    const map = new Map<string, { sku: string; amount: number; revenue: number }>();
    for (const s of filteredSalesForRange) {
      const prev = map.get(s.sku);
      if (!prev) map.set(s.sku, { sku: s.sku, amount: s.amount, revenue: s.revenue ?? 0 });
      else {
        prev.amount += s.amount;
        prev.revenue += s.revenue ?? 0;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [filteredSalesForRange]);

  // compute best month and best date
  const bestMonth = useMemo(() => {
    if (!totals || totals.length === 0) return null;
    return totals.reduce((a, b) => (b.amount > a.amount ? b : a), totals[0]);
  }, [totals]);

  const bestDate = useMemo(() => {
    // aggregate by YYYY-MM-DD
    const map = new Map<string, number>();
    for (const s of sales) {
      const y = s.timestamp.getFullYear();
      const m = String(s.timestamp.getMonth() + 1).padStart(2, '0');
      const d = String(s.timestamp.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      map.set(key, (map.get(key) ?? 0) + s.amount);
    }
    if (map.size === 0) return null;
    const arr = Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
    return arr.reduce((a, b) => (b.amount > a.amount ? b : a), arr[0]);
  }, [sales]);

  // trend data for selected SKU: use whole-life (daily cumulative) trend
  const trend = useMemo(() => {
    if (!selectedSku) return [];
    return lifetimeTrend(sales, selectedSku);
  }, [sales, selectedSku]);

  const chartData = trend.map((t) => ({ date: t.date, amount: t.amount }));
  

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm">
                <Button variant="ghost" asChild size="sm">
                    <Link href="/admin/orders">處理訂單</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link href="/admin/upload">上傳 SKU</Link>
                </Button>
                <Button variant="ghost" asChild size="sm">
                    <Link href="/admin/skus">管理 SKUs</Link>
                </Button>
                <Button variant="secondary" asChild size="sm" className="bg-[#C4A59D]/20 text-[#8B5E53] hover:bg-[#C4A59D]/30">
                    <Link href="/admin/best-sellers">熱賣 SKU</Link>
                </Button>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">總銷量</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summaryForRange.units.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">件</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">總營收</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${summaryForRange.revenue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">HKD</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">最佳月份</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{bestMonth ? bestMonth.month : '—'}</div>
                    <p className="text-xs text-muted-foreground">{bestMonth ? `${bestMonth.amount} 件` : 'no data'}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">最佳單日</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold truncate" title={bestDate?.date}>{bestDate ? bestDate.date : '—'}</div>
                    <p className="text-xs text-muted-foreground">{bestDate ? `${bestDate.amount} 件` : 'no data'}</p>
                </CardContent>
            </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Sidebar: Top Sellers List */}
            <Card className="lg:col-span-1 h-[600px] flex flex-col">
                <CardHeader>
                    <CardTitle>Top Sellers</CardTitle>
                    <CardDescription>
                       {activeTab === 'sku' ? 'All-time Top 5' : 'Ranked by volume in period'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pr-2">
                     <div className="space-y-3">
                        {(activeTab === 'sku' ? topAllTime : topSkusForRange).map((s, index) => (
                             <div 
                                key={s.sku} 
                                className={`
                                    group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md
                                    ${selectedSku === s.sku ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-white border-transparent hover:border-gray-100'}
                                `}
                                onClick={() => { setSelectedSku(s.sku); if(activeTab !== 'sku') setActiveTab('sku'); }}
                             >
                                <div className="flex items-center gap-3">
                                    <Badge variant={index < 3 ? "default" : "secondary"} className={`w-6 h-6 rounded-full flex items-center justify-center p-0 ${index === 0 ? 'bg-yellow-500 hover:bg-yellow-600' : index === 1 ? 'bg-gray-400 hover:bg-gray-500' : index === 2 ? 'bg-orange-400 hover:bg-orange-500' : ''}`}>
                                        {index + 1}
                                    </Badge>
                                    <div>
                                        <div className="font-medium text-sm">{s.sku}</div>
                                        <div className="text-xs text-muted-foreground">{s.amount} sold</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium">${s.revenue?.toLocaleString()}</div>
                                    <TrendingUp className="w-3 h-3 text-green-500 ml-auto" />
                                </div>
                             </div>
                        ))}
                     </div>
                </CardContent>
            </Card>

            {/* Main Chart Area */}
            <Card className="lg:col-span-2 flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle>Analytics</CardTitle>
                        <CardDescription>
                            {activeTab === 'totals' ? "Monthly sales performance over time" : `Sales trend for SKU: ${selectedSku}`}
                        </CardDescription>
                    </div>
                     <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'totals' | 'sku')} className="w-auto">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="totals">Monthly</TabsTrigger>
                            <TabsTrigger value="sku">SKU Trend</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="flex-1">
                     <div className="mb-6 flex justify-end">
                        <div className="inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground">
                            {(['30d', '3m', '6m', '1y'] as const).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`
                                        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                                        ${range === r ? 'bg-white text-foreground shadow-sm' : 'hover:bg-white/50'}
                                    `}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                     </div>
                     
                     <div className="h-[400px] w-full">
                        {activeTab === 'totals' ? (
                             <ChartContainer id="monthly-total-trend" config={{ amount: { label: 'Total Units', color: 'hsl(var(--primary))' } }} className="h-full w-full">
                                <Recharts.ResponsiveContainer width="100%" height="100%">
                                    <Recharts.AreaChart data={totalsChartData}>
                                        <defs>
                                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <Recharts.XAxis 
                                            dataKey="month" 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={10} 
                                            tickFormatter={(value) => value.slice(0, 7)}
                                        />
                                        <Recharts.YAxis 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={10}
                                        />
                                        <Recharts.Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Recharts.Area 
                                            type="monotone" 
                                            dataKey="amount" 
                                            stroke="var(--color-amount)" 
                                            fillOpacity={1} 
                                            fill="url(#colorAmount)" 
                                            strokeWidth={2}
                                        />
                                    </Recharts.AreaChart>
                                </Recharts.ResponsiveContainer>
                             </ChartContainer>
                        ) : (
                            <ChartContainer id="sku-trend" config={{ amount: { label: 'Sales', color: 'hsl(var(--primary))' } }} className="h-full w-full">
                                 <Recharts.ResponsiveContainer width="100%" height="100%">
                                    <Recharts.LineChart data={chartData}>
                                        <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <Recharts.XAxis 
                                            dataKey="date" 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={10}
                                            tickFormatter={(value) => {
                                                const d = new Date(value);
                                                return `${d.getMonth()+1}/${d.getDate()}`;
                                            }}
                                        />
                                        <Recharts.YAxis 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={10}
                                        />
                                        <Recharts.Tooltip
                                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                             labelFormatter={(value) => new Date(value).toLocaleDateString()}
                                        />
                                        <Recharts.Line 
                                            type="monotone" 
                                            dataKey="amount" 
                                            stroke="var(--color-amount)" 
                                            strokeWidth={2} 
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                        />
                                    </Recharts.LineChart>
                                </Recharts.ResponsiveContainer>
                            </ChartContainer>
                        )}
                     </div>

                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}
