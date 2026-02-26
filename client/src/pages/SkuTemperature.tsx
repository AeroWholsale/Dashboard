import { useState } from "react";
import { useSkuTemperature } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Flame, TrendingUp, TrendingDown, AlertTriangle, BarChart3, Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const trendConfig: Record<string, { color: string; bg: string; icon: any }> = {
  HOT: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", icon: Flame },
  RISING: { color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30", icon: TrendingUp },
  STABLE: { color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", icon: BarChart3 },
  FALLING: { color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30", icon: TrendingDown },
  DEAD: { color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30", icon: AlertTriangle },
};

const categories = ["All", "Tablet", "Phone", "Laptop", "Accessory"];

export default function SkuTemperature() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { data, isLoading } = useSkuTemperature(category, search);

  const filteredItems = activeFilter
    ? (data?.items || []).filter((i: any) => i.trend === activeFilter)
    : (data?.items || []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">SKU Temperature</h1>
          <button onClick={() => downloadCsv(filteredItems, [{ key: "product", label: "Product" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" }, { key: "trend", label: "Trend" }, { key: "thisWeek", label: "This Week" }, { key: "lastWeek", label: "Last Week" }, { key: "soldMtd", label: "Sold MTD" }, { key: "mtdRevenue", label: "MTD Rev" }, { key: "soldLm", label: "Sold LM" }, { key: "lmRevenue", label: "LM Rev" }, { key: "mtdVsLm", label: "MTD vs LM %" }], `sku-temperature-${todayStr()}.csv`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" data-testid="btn-export-temperature">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { key: "HOT", label: "Hot", val: data?.stats.hot, icon: Flame, color: "text-red-400" },
            { key: "RISING", label: "Rising", val: data?.stats.rising, icon: TrendingUp, color: "text-emerald-400" },
            { key: "FALLING", label: "Falling", val: data?.stats.falling, icon: TrendingDown, color: "text-amber-400" },
            { key: "DEAD", label: "Dead", val: data?.stats.dead, icon: AlertTriangle, color: "text-gray-400" },
            { key: null, label: "Total SKUs", val: data?.stats.totalSkus, icon: BarChart3, color: "text-white" },
          ].map((s) => (
            <div
              key={s.label}
              className={`p-4 rounded-lg bg-[#0c1220] border cursor-pointer transition-colors ${
                activeFilter === s.key ? "border-blue-500" : "border-[#1a2844] hover:border-white/30"
              }`}
              onClick={() => setActiveFilter(activeFilter === s.key ? null : s.key)}
              data-testid={`card-stat-${s.label.toLowerCase()}`}
            >
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <s.icon className={`w-4 h-4 ${s.color}`} />{s.label}
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{(s.val || 0).toLocaleString()}</p>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SKUs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/20"
              data-testid="input-search-sku"
            />
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
                {c}
              </button>
            ))}
          </div>
        </div>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-64 m-4" /> : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10 text-xs uppercase">
                      <th className="text-left py-3 px-4">Product</th>
                      <th className="text-center py-3 px-2">Trend</th>
                      <th className="text-right py-3 px-2">This Week</th>
                      <th className="text-right py-3 px-2">Last Week</th>
                      <th className="text-right py-3 px-2">Sold MTD</th>
                      <th className="text-right py-3 px-2">MTD Revenue</th>
                      <th className="text-right py-3 px-2">Sold LM</th>
                      <th className="text-right py-3 px-2">LM Revenue</th>
                      <th className="text-right py-3 px-2">MTD vs LM %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No data available. Upload sales data to see trends.</td></tr>
                    ) : filteredItems.map((item: any) => {
                      const tc = trendConfig[item.trend] || trendConfig.STABLE;
                      return (
                        <tr key={item.sku} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedProduct(item)}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-white text-sm">{item.product}</p>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge className={`text-xs ${tc.bg} ${tc.color}`}>{item.trend}</Badge>
                          </td>
                          <td className="py-3 px-2 text-right">{item.thisWeek}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">{item.lastWeek}</td>
                          <td className="py-3 px-2 text-right font-medium">{item.soldMtd}</td>
                          <td className="py-3 px-2 text-right">{fmt(item.mtdRevenue)}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">{item.soldLm}</td>
                          <td className="py-3 px-2 text-right text-muted-foreground">{fmt(item.lmRevenue)}</td>
                          <td className="py-3 px-2 text-right">
                            <span className={item.mtdVsLm >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {item.mtdVsLm >= 0 ? "+" : ""}{item.mtdVsLm}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-2xl bg-[#111827] border-[#1a2844]">
            <DialogHeader>
              <DialogTitle className="text-lg">{selectedProduct?.product}</DialogTitle>
              <p className="text-xs text-muted-foreground">{selectedProduct?.sku}</p>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Badge className={`text-sm px-3 py-1 ${(trendConfig[selectedProduct.trend] || trendConfig.STABLE).bg} ${(trendConfig[selectedProduct.trend] || trendConfig.STABLE).color}`}>
                    {selectedProduct.trend}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "This Week", value: selectedProduct.thisWeek },
                    { label: "Last Week", value: selectedProduct.lastWeek },
                    { label: "Sold MTD", value: selectedProduct.soldMtd },
                    { label: "MTD Revenue", value: fmt(selectedProduct.mtdRevenue) },
                    { label: "Sold Last Month", value: selectedProduct.soldLm },
                    { label: "LM Revenue", value: fmt(selectedProduct.lmRevenue) },
                    { label: "MTD vs LM", value: `${selectedProduct.mtdVsLm >= 0 ? "+" : ""}${selectedProduct.mtdVsLm}%`, color: selectedProduct.mtdVsLm >= 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "Category", value: selectedProduct.category },
                  ].map(c => (
                    <div key={c.label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                      <p className={`text-sm font-bold ${(c as any).color || "text-white"}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
