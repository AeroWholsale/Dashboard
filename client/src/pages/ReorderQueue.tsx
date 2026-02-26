import { useState } from "react";
import { useReorderQueue } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, AlertTriangle, Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmt2 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

const urgencyColor: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  URGENT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  LOW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  OK: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const gradeColor: Record<string, string> = {
  CAP1: "bg-purple-500/20 text-purple-400", CAP: "bg-purple-500/20 text-purple-400",
  "CA+": "bg-emerald-500/20 text-emerald-400", CA: "bg-emerald-500/20 text-emerald-400",
  SD: "bg-amber-500/20 text-amber-400", "SD-": "bg-amber-500/20 text-amber-400", SDB: "bg-amber-500/20 text-amber-400",
};

export default function ReorderQueue() {
  const [targetMargin, setTargetMargin] = useState(20);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { data, isLoading } = useReorderQueue(targetMargin);

  const toggle = (family: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(family) ? next.delete(family) : next.add(family);
      return next;
    });
  };

  const filteredFamilies = activeFilter ? (data?.families || []).filter((f: any) => f.urgency === activeFilter) : (data?.families || []);
  const categoryFiltered = category !== "All" ? filteredFamilies.filter((f: any) => f.skus?.some((s: any) => s.category === category)) : filteredFamilies;

  const statCards = [
    { label: "Critical <=2d", val: data?.stats.critical, color: "text-red-400", filter: "CRITICAL" as string | null },
    { label: "Urgent <=5d", val: data?.stats.urgent, color: "text-amber-400", filter: "URGENT" as string | null },
    { label: "Low <=14d", val: data?.stats.low, color: "text-blue-400", filter: "LOW" as string | null },
    { label: "Total Reorder Qty", val: data?.stats.totalReorderQty, color: "text-white", filter: null },
    { label: "Est. Purchase Cost", val: data?.stats.estPurchaseCost, color: "text-white", isCurrency: true, filter: null },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-white">Reorder Queue</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const exportRows = categoryFiltered.flatMap((f: any) => 
                (f.skus || []).map((s: any) => ({
                  product: s.product || f.product,
                  sku: s.sku,
                  category: s.category || "",
                  urgency: s.urgency,
                  onHand: s.onHand,
                  daysLeft: s.daysLeft >= 999 ? "" : s.daysLeft,
                  velocity: s.velocity?.toFixed(2) || "0",
                  soldLw: s.soldLw,
                  soldMtd: s.soldMtd,
                  lastMonth: s.lastMonth,
                  smly: s.smly,
                  avgCost: s.avgCost || "",
                  maxBuy: s.maxBuy || "",
                  reorderQty: s.reorderQty,
                }))
              );
              downloadCsv(exportRows, [{ key: "product", label: "Product" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" }, { key: "urgency", label: "Urgency" }, { key: "onHand", label: "On Hand" }, { key: "daysLeft", label: "Days Left" }, { key: "velocity", label: "Vel/Day" }, { key: "soldLw", label: "Sold LW" }, { key: "soldMtd", label: "Sold MTD" }, { key: "lastMonth", label: "Last Month" }, { key: "smly", label: "SMLY" }, { key: "avgCost", label: "Avg Cost" }, { key: "maxBuy", label: "Max Buy" }, { key: "reorderQty", label: "Reorder Qty" }], `reorder-queue-${todayStr()}.csv`);
            }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" data-testid="btn-export-reorder">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <span className="text-sm text-muted-foreground">Target Margin:</span>
            <Input type="number" value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value) || 20)} className="w-20 bg-white/5 border-white/20 text-center" data-testid="input-target-margin" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={`p-4 rounded-lg bg-[#0c1220] border cursor-pointer transition-colors ${activeFilter === s.filter && s.filter !== null ? "border-blue-500" : "border-[#1a2844]"}`}
              onClick={() => {
                if (s.filter === null) {
                  setActiveFilter(null);
                } else {
                  setActiveFilter(activeFilter === s.filter ? null : s.filter);
                }
              }}
              data-testid={`card-stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}
            >
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <>
                  <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.isCurrency ? fmt(s.val || 0) : (s.val || 0).toLocaleString()}</p>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {["All", "Tablet", "Phone", "Laptop", "Accessory"].map(c => (
            <button
              key={c}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${category === c ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"}`}
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c.toLowerCase()}`}
            >
              {c}
            </button>
          ))}
        </div>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-64 m-4" /> : !categoryFiltered?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No items need reordering. Upload inventory and sales data first.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10 text-xs uppercase">
                      <th className="py-3 px-4 w-8"></th>
                      <th className="text-left py-3 px-2">Product</th>
                      <th className="text-center py-3 px-2">Urgency</th>
                      <th className="text-right py-3 px-2">On Hand</th>
                      <th className="text-right py-3 px-2">Days Left</th>
                      <th className="text-right py-3 px-2">Vel/Day</th>
                      <th className="text-right py-3 px-2">Sold LW</th>
                      <th className="text-right py-3 px-2">Sold MTD</th>
                      <th className="text-right py-3 px-2">Last Month</th>
                      <th className="text-right py-3 px-2">SMLY</th>
                      <th className="text-right py-3 px-2">Avg Cost</th>
                      <th className="text-right py-3 px-2">Max Buy</th>
                      <th className="text-right py-3 px-2">Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryFiltered.map((fam: any) => (
                      <FamilyRow key={fam.productFamily} fam={fam} expanded={expanded.has(fam.productFamily)} toggle={() => toggle(fam.productFamily)} onDetail={(item: any) => setSelectedProduct(item)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-2xl bg-[#111827] border-[#1a2844]">
            <DialogHeader>
              <DialogTitle className="text-lg">{selectedProduct?.product || selectedProduct?.sku || "Product Detail"}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {selectedProduct.sku && <span className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</span>}
                  {!selectedProduct.sku && <span className="text-sm text-muted-foreground">Family</span>}
                  <Badge className={`text-xs ${urgencyColor[selectedProduct.urgency] || ""}`}>{selectedProduct.urgency}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "On Hand", value: selectedProduct.onHand },
                    { label: "Unit Cost", value: selectedProduct.avgCost ? `$${selectedProduct.avgCost}` : "-" },
                    { label: "Avg Sell Price", value: selectedProduct.avgSellPrice ? fmt2(selectedProduct.avgSellPrice) : (selectedProduct.maxBuy ? `$${selectedProduct.maxBuy}` : "-") },
                    { label: "Velocity/Day", value: selectedProduct.velocity?.toFixed(2) || "0" },
                    { label: "Days of Stock", value: selectedProduct.daysLeft >= 999 ? "999+" : selectedProduct.daysLeft },
                    { label: "Sold MTD", value: selectedProduct.soldMtd },
                    { label: "Sold Last Month", value: selectedProduct.lastMonth },
                    { label: "SMLY", value: selectedProduct.smly },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                      <p className="text-lg font-semibold text-white">{m.value ?? "-"}</p>
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

function FamilyRow({ fam, expanded, toggle, onDetail }: { fam: any; expanded: boolean; toggle: () => void; onDetail: (item: any) => void }) {
  return (
    <>
      <tr className="border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => onDetail(fam)}>
        <td className="py-3 px-4" onClick={(e) => { e.stopPropagation(); toggle(); }}>{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
        <td className="py-3 px-2 font-medium text-white">{fam.product}</td>
        <td className="py-3 px-2 text-center"><Badge className={`text-xs ${urgencyColor[fam.urgency] || ""}`}>{fam.urgency}</Badge></td>
        <td className="py-3 px-2 text-right">{fam.onHand}</td>
        <td className="py-3 px-2 text-right"><span className={fam.daysLeft <= 2 ? "text-red-400" : fam.daysLeft <= 5 ? "text-amber-400" : ""}>{fam.daysLeft >= 999 ? "-" : fam.daysLeft}</span></td>
        <td className="py-3 px-2 text-right">{fam.velocity?.toFixed(1)}</td>
        <td className="py-3 px-2 text-right">{fam.soldLw}</td>
        <td className="py-3 px-2 text-right">{fam.soldMtd}</td>
        <td className="py-3 px-2 text-right">{fam.lastMonth}</td>
        <td className="py-3 px-2 text-right">{fam.smly}</td>
        <td className="py-3 px-2 text-right">{fam.avgCost > 0 ? `$${fam.avgCost}` : "N/A"}</td>
        <td className="py-3 px-2 text-right">{fam.maxBuy > 0 ? `$${fam.maxBuy}` : "N/A"}</td>
        <td className="py-3 px-2 text-right font-bold text-white">{fam.reorderQty}</td>
      </tr>
      {expanded && fam.skus?.map((sku: any) => (
        <tr key={sku.sku} className="border-b border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5" onClick={() => onDetail(sku)}>
          <td className="py-2 px-4"></td>
          <td className="py-2 px-2 pl-8 text-muted-foreground text-xs">
            <Badge className={`text-xs mr-2 ${gradeColor[sku.grade] || "bg-white/10 text-white/60"}`}>{sku.grade || "?"}</Badge>
            {sku.sku}
          </td>
          <td className="py-2 px-2 text-center"><Badge className={`text-xs ${urgencyColor[sku.urgency] || ""}`}>{sku.urgency}</Badge></td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.onHand}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.daysLeft >= 999 ? "-" : sku.daysLeft}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.velocity?.toFixed(1)}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.soldLw}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.soldMtd}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.lastMonth}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.smly}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.avgCost > 0 ? `$${sku.avgCost}` : "N/A"}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.maxBuy > 0 ? `$${sku.maxBuy}` : "N/A"}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.reorderQty}</td>
        </tr>
      ))}
    </>
  );
}
