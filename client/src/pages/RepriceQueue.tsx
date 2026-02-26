import { useState, useMemo } from "react";
import { useRepriceQueue } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronUp, ChevronDown, Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmt2 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

const categories = ["All", "Phone", "Tablet", "Laptop", "Accessory"];

type SortKey = "product" | "status" | "qty" | "avgPrice" | "cost" | "pace" | "soldMtd" | "soldLm" | "capital";
type SortDir = "asc" | "desc";

export default function RepriceQueue() {
  const { data, isLoading } = useRepriceQueue();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newPrice, setNewPrice] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [recentlyDeadOnly, setRecentlyDeadOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("capital");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const allItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items;
  }, [data]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    for (const item of allItems) {
      counts.All++;
      const cat = item.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  const displayItems = useMemo(() => {
    let items = allItems;

    if (search) {
      const s = search.toLowerCase();
      items = items.filter((i: any) => i.product.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s));
    }

    if (category !== "All") {
      items = items.filter((i: any) => i.category === category);
    }

    if (activeFilter) {
      items = items.filter((i: any) => i.status === activeFilter);
    }

    if (recentlyDeadOnly) {
      items = items.filter((i: any) => i.status === "DEAD" && i.soldLm > 0);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    items = [...items].sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });

    return items;
  }, [allItems, search, category, activeFilter, recentlyDeadOnly, sortKey, sortDir]);

  const totalCapital = useMemo(() => {
    return displayItems.reduce((sum: number, i: any) => sum + (i.capital || 0), 0);
  }, [displayItems]);

  const openModal = (item: any) => {
    setSelectedItem(item);
    setNewPrice(item.avgPrice || 0);
  };

  const feeRate = 0.15;
  const simMargin = selectedItem && newPrice > 0 ? ((newPrice - selectedItem.cost - newPrice * feeRate) / newPrice) * 100 : 0;
  const simProfitPerUnit = selectedItem ? newPrice - selectedItem.cost - newPrice * feeRate : 0;
  const simTotalProfit = selectedItem ? simProfitPerUnit * selectedItem.qty : 0;

  const SortHeader = ({ label, field, align = "right" }: { label: string; field: SortKey; align?: string }) => (
    <th
      className={`py-3 px-2 cursor-pointer select-none hover:text-white transition-colors ${align === "left" ? "text-left px-4" : align === "center" ? "text-center" : "text-right"}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : null}
      </span>
    </th>
  );

  const kpiCards = [
    { label: "Dead SKUs", val: data?.stats.deadSkus, color: "text-gray-400", filterKey: "DEAD" },
    { label: "Dead Capital", val: data?.stats.deadCapital, color: "text-red-400", isCurrency: true, filterKey: "DEAD" },
    { label: "Slow Movers", val: data?.stats.slowMovers, color: "text-amber-400", filterKey: "SLOW" },
    { label: "Slow Capital", val: data?.stats.slowCapital, color: "text-amber-400", isCurrency: true, filterKey: "SLOW" },
    { label: "Total At Risk", val: data?.stats.totalAtRisk, color: "text-red-400", isCurrency: true, filterKey: null },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">Reprice / Action Queue</h1>
          <button
            onClick={() => {
              const rows = displayItems.map((item: any) => ({
                product: item.product,
                sku: item.sku,
                category: item.category,
                status: item.status,
                qty: item.qty,
                avgPrice: item.avgPrice ?? "N/A",
                cost: item.cost,
                pace: item.pace,
                soldMtd: item.soldMtd,
                soldLm: item.soldLm,
                capital: item.capital,
              }));
              downloadCsv(rows, [
                { key: "product", label: "Product" },
                { key: "sku", label: "SKU" },
                { key: "category", label: "Category" },
                { key: "status", label: "Status" },
                { key: "qty", label: "Qty" },
                { key: "avgPrice", label: "Avg Price" },
                { key: "cost", label: "Cost" },
                { key: "pace", label: "Pace%" },
                { key: "soldMtd", label: "Sold MTD" },
                { key: "soldLm", label: "Sold LM" },
                { key: "capital", label: "Capital" },
              ], `reprice-queue-${todayStr()}.csv`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            data-testid="btn-export-reprice"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {kpiCards.map((s) => {
            const isActive = s.filterKey === null
              ? activeFilter === null
              : activeFilter === s.filterKey;
            return (
              <div
                key={s.label}
                className={`p-4 rounded-lg bg-[#0c1220] border cursor-pointer transition-colors ${
                  isActive ? "border-blue-500" : "border-[#1a2844] hover:border-white/30"
                }`}
                onClick={() => {
                  if (s.filterKey === null) {
                    setActiveFilter(null);
                  } else {
                    setActiveFilter(activeFilter === s.filterKey ? null : s.filterKey);
                  }
                }}
                data-testid={`card-stat-${s.label.toLowerCase().replace(/ /g, "-")}`}
              >
                {isLoading ? <Skeleton className="h-12 w-full" /> : (
                  <>
                    <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.isCurrency ? fmt(s.val || 0) : (s.val || 0).toLocaleString()}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/20 w-64" data-testid="input-search-reprice" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={recentlyDeadOnly} onCheckedChange={setRecentlyDeadOnly} data-testid="toggle-recently-dead" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Recently Dead Only</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                category === c ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
              }`}
              onClick={() => setCategory(c)}
              data-testid={`pill-category-${c.toLowerCase()}`}
            >
              {c} {categoryCounts[c] !== undefined ? `(${categoryCounts[c]})` : "(0)"}
            </button>
          ))}
        </div>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-64 m-4" /> : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10 text-xs uppercase">
                      <SortHeader label="Product" field="product" align="left" />
                      <SortHeader label="Status" field="status" align="center" />
                      <SortHeader label="Qty" field="qty" />
                      <SortHeader label="Avg Price" field="avgPrice" />
                      <SortHeader label="Cost" field="cost" />
                      <SortHeader label="Pace%" field="pace" />
                      <SortHeader label="Sold MTD" field="soldMtd" />
                      <SortHeader label="Sold LM" field="soldLm" />
                      <SortHeader label="Capital" field="capital" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No at-risk inventory. Upload data to see repricing opportunities.</td></tr>
                    ) : displayItems.map((item: any) => (
                      <tr key={item.sku} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => openModal(item)} data-testid={`row-reprice-${item.sku}`}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-white text-sm" data-testid={`text-product-${item.sku}`}>{item.product}</p>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={item.status === "DEAD" ? "bg-gray-500/20 text-gray-400" : "bg-amber-500/20 text-amber-400"} data-testid={`badge-status-${item.sku}`}>{item.status}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right" data-testid={`text-qty-${item.sku}`}>{item.qty}</td>
                        <td className="py-3 px-2 text-right" data-testid={`text-avgprice-${item.sku}`}>
                          {item.avgPrice !== null ? fmt2(item.avgPrice) : <span className="text-muted-foreground">N/A</span>}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground" data-testid={`text-cost-${item.sku}`}>{fmt2(item.cost)}</td>
                        <td className="py-3 px-2 text-right">
                          <span className={item.pace < 30 ? "text-red-400" : "text-emerald-400"}>{item.pace}%</span>
                        </td>
                        <td className="py-3 px-2 text-right">{item.soldMtd}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{item.soldLm}</td>
                        <td className="py-3 px-2 text-right font-medium text-white" data-testid={`text-capital-${item.sku}`}>{fmt(item.capital)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!isLoading && displayItems.length > 0 && (
              <div className="px-4 py-3 border-t border-white/10 flex justify-between items-center text-sm text-muted-foreground" data-testid="table-footer">
                <span>Showing {displayItems.length} items</span>
                <span>Total Capital: <span className="text-white font-medium">{fmt(totalCapital)}</span></span>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-2xl bg-[#111827] border-[#1a2844]">
            <DialogHeader>
              <DialogTitle className="text-lg" data-testid="text-modal-title">Price Simulator: {selectedItem?.product}</DialogTitle>
              <p className="text-xs text-muted-foreground">{selectedItem?.sku}</p>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-6">
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "On Hand", value: selectedItem.qty },
                    { label: "Current Price", value: selectedItem.avgPrice !== null ? fmt2(selectedItem.avgPrice) : "N/A" },
                    { label: "Your Cost", value: fmt2(selectedItem.cost) },
                    { label: "Current Margin", value: `${selectedItem.currentMargin}%`, color: selectedItem.currentMargin >= 15 ? "text-emerald-400" : selectedItem.currentMargin >= 0 ? "text-amber-400" : "text-red-400" },
                    { label: "Capital Tied Up", value: fmt(selectedItem.capital) },
                  ].map(c => (
                    <div key={c.label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                      <p className={`text-sm font-bold ${(c as any).color || "text-white"}`}>{c.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">New Price</span>
                    <Input type="number" value={newPrice.toFixed(2)} onChange={(e) => setNewPrice(Number(e.target.value))} className="w-28 bg-white/5 border-white/20 text-right" data-testid="input-new-price" />
                  </div>
                  <Slider
                    value={[newPrice]}
                    onValueChange={([v]) => setNewPrice(v)}
                    min={Math.max(0, selectedItem.cost * 0.5)}
                    max={(selectedItem.avgPrice || selectedItem.cost * 2) * 1.5 || 500}
                    step={0.5}
                    className="w-full"
                    data-testid="slider-price"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">New Margin</p>
                      <p className={`text-lg font-bold ${simMargin >= 15 ? "text-emerald-400" : simMargin >= 0 ? "text-amber-400" : "text-red-400"}`}>
                        {simMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Profit/Unit</p>
                      <p className={`text-lg font-bold ${simProfitPerUnit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt2(simProfitPerUnit)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total if Sell All</p>
                      <p className={`text-lg font-bold ${simTotalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmt(simTotalProfit)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setNewPrice(selectedItem.avgPrice || 0)} className="border-white/20">Current Price</Button>
                    <Button variant="outline" size="sm" onClick={() => setNewPrice((selectedItem.avgPrice || 0) * 0.95)} className="border-white/20">-5%</Button>
                    <Button variant="outline" size="sm" onClick={() => setNewPrice((selectedItem.avgPrice || 0) * 0.90)} className="border-white/20">-10%</Button>
                    <Button variant="outline" size="sm" onClick={() => setNewPrice(selectedItem.wholesaleFloor)} className="border-white/20">Wholesale Floor</Button>
                    <Button variant="outline" size="sm" onClick={() => setNewPrice(selectedItem.breakEven)} className="border-white/20">Break Even</Button>
                  </div>

                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Break-Even: <span className="text-white font-medium">{fmt2(selectedItem.breakEven)}</span></span>
                    <span>Wholesale Floor: <span className="text-white font-medium">{fmt2(selectedItem.wholesaleFloor)}</span></span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
