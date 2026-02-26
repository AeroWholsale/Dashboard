import { useState } from "react";
import { useInventory } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronDown, Search, Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const healthDot: Record<string, string> = {
  dead: "bg-gray-400",
  critical: "bg-red-500",
  low: "bg-amber-500",
  healthy: "bg-emerald-500",
  overstocked: "bg-blue-500",
};

const healthBadge: Record<string, string> = {
  dead: "bg-gray-500/20 text-gray-400",
  critical: "bg-red-500/20 text-red-400",
  low: "bg-amber-500/20 text-amber-400",
  healthy: "bg-emerald-500/20 text-emerald-400",
  overstocked: "bg-blue-500/20 text-blue-400",
};

const gradeColor: Record<string, string> = {
  CAP1: "bg-purple-500/20 text-purple-400", CAP: "bg-purple-500/20 text-purple-400",
  "CA+": "bg-emerald-500/20 text-emerald-400", CA: "bg-emerald-500/20 text-emerald-400",
  SD: "bg-amber-500/20 text-amber-400", "SD-": "bg-amber-500/20 text-amber-400", SDB: "bg-amber-500/20 text-amber-400",
};

const categories = ["All", "Tablet", "Phone", "Laptop", "Accessory"];

export default function Inventory() {
  const [activeOnly, setActiveOnly] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { data, isLoading } = useInventory(activeOnly, category, search);

  const toggle = (family: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(family) ? next.delete(family) : next.add(family);
      return next;
    });
  };

  const filteredFamilies = activeFilter
    ? (data?.families || []).filter((f: any) => f.health === activeFilter)
    : (data?.families || []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-white">Inventory Browser</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const exportRows = filteredFamilies.flatMap((f: any) =>
                  (f.skus || []).map((s: any) => ({
                    product: s.product || f.product,
                    sku: s.sku,
                    category: s.category || "",
                    grade: s.grade || "",
                    health: s.health || "",
                    available: s.available,
                    cost: s.cost || "",
                    capital: s.capital,
                    velocity: s.velocity?.toFixed(2) || "0",
                    daysLeft: s.daysLeft >= 999 ? "" : s.daysLeft,
                    soldMtd: s.soldMtd,
                    revMtd: s.revMtd || 0,
                  }))
                );
                downloadCsv(exportRows, [
                  { key: "product", label: "Product" },
                  { key: "sku", label: "SKU" },
                  { key: "category", label: "Category" },
                  { key: "grade", label: "Grade" },
                  { key: "health", label: "Health" },
                  { key: "available", label: "Available" },
                  { key: "cost", label: "Cost" },
                  { key: "capital", label: "Capital" },
                  { key: "velocity", label: "Vel/Day" },
                  { key: "daysLeft", label: "Days Left" },
                  { key: "soldMtd", label: "Sold MTD" },
                  { key: "revMtd", label: "Rev MTD" },
                ], `inventory-${todayStr()}.csv`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              data-testid="btn-export-inventory"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <span className="text-sm text-muted-foreground">Active Only</span>
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} data-testid="switch-active-only" />
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { key: "dead", label: "Dead", val: data?.stats.dead, color: "text-gray-400" },
            { key: "critical", label: "Critical <=5d", val: data?.stats.critical, color: "text-red-400" },
            { key: "low", label: "Low <=14d", val: data?.stats.low, color: "text-amber-400" },
            { key: "healthy", label: "Healthy", val: data?.stats.healthy, color: "text-emerald-400" },
            { key: "overstocked", label: "Overstocked", val: data?.stats.overstocked, color: "text-blue-400" },
          ].map((s) => (
            <div
              key={s.label}
              className={`p-4 rounded-lg bg-[#0c1220] border cursor-pointer transition-colors ${
                activeFilter === s.key ? "border-blue-500" : "border-[#1a2844] hover:border-white/30"
              }`}
              onClick={() => setActiveFilter(activeFilter === s.key ? null : s.key)}
              data-testid={`card-health-${s.key}`}
            >
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <>
                  <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{(s.val || 0).toLocaleString()}</p>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/20" data-testid="input-search-inventory" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  category === c ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
                }`}
                onClick={() => setCategory(c)}
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
                      <th className="py-3 px-4 w-8"></th>
                      <th className="text-left py-3 px-2">Product</th>
                      <th className="text-center py-3 px-2">Health</th>
                      <th className="text-right py-3 px-2">Available</th>
                      <th className="text-right py-3 px-2">Capital</th>
                      <th className="text-right py-3 px-2">Vel/Day</th>
                      <th className="text-right py-3 px-2">Days Left</th>
                      <th className="text-right py-3 px-2">Sold MTD</th>
                      <th className="text-right py-3 px-2">Rev MTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFamilies.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No inventory data. Upload InventoryByProductDetail and sales data first.</td></tr>
                    ) : filteredFamilies.map((fam: any) => (
                      <InventoryFamily key={fam.productFamily} fam={fam} expanded={expanded.has(fam.productFamily)} toggle={() => toggle(fam.productFamily)} onDetail={setSelectedProduct} />
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
              <DialogTitle className="text-lg">{selectedProduct?.product || selectedProduct?.productFamily}</DialogTitle>
              <p className="text-xs text-muted-foreground">{selectedProduct?.sku || "Product Family"}</p>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Badge className={`text-sm px-3 py-1 ${healthBadge[selectedProduct.health] || ""}`}>
                    {selectedProduct.health?.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Available", value: selectedProduct.available },
                    { label: "Capital", value: fmt(selectedProduct.capital) },
                    { label: "Unit Cost", value: selectedProduct.cost ? `$${selectedProduct.cost}` : "-" },
                    { label: "Velocity/Day", value: selectedProduct.velocity?.toFixed(2) },
                    { label: "Days Left", value: selectedProduct.daysLeft >= 999 ? "∞" : selectedProduct.daysLeft },
                    { label: "Sold MTD", value: selectedProduct.soldMtd },
                    { label: "Rev MTD", value: fmt(selectedProduct.revMtd || 0) },
                    { label: "Category", value: selectedProduct.category },
                  ].map(c => (
                    <div key={c.label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                      <p className="text-sm font-bold text-white">{c.value}</p>
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

function InventoryFamily({ fam, expanded, toggle, onDetail }: { fam: any; expanded: boolean; toggle: () => void; onDetail: (item: any) => void }) {
  return (
    <>
      <tr className="border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => onDetail(fam)}>
        <td className="py-3 px-4" onClick={(e) => { e.stopPropagation(); toggle(); }}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${healthDot[fam.health] || "bg-gray-400"}`}></div>
            <span className="font-medium text-white">{fam.product}</span>
          </div>
        </td>
        <td className="py-3 px-2 text-center"><Badge className={`text-xs ${healthBadge[fam.health] || ""}`}>{fam.health?.toUpperCase()}</Badge></td>
        <td className="py-3 px-2 text-right">{fam.available}</td>
        <td className="py-3 px-2 text-right">{fmt(fam.capital)}</td>
        <td className="py-3 px-2 text-right">{fam.velocity?.toFixed(1)}</td>
        <td className="py-3 px-2 text-right">{fam.daysLeft >= 999 ? "-" : fam.daysLeft}</td>
        <td className="py-3 px-2 text-right">{fam.soldMtd}</td>
        <td className="py-3 px-2 text-right">{fmt(fam.revMtd)}</td>
      </tr>
      {expanded && fam.skus?.map((sku: any) => (
        <tr key={sku.sku} className="border-b border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04]" onClick={() => onDetail(sku)}>
          <td className="py-2 px-4"></td>
          <td className="py-2 px-2 pl-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${healthDot[sku.health] || "bg-gray-400"}`}></div>
              <Badge className={`text-xs mr-1 ${gradeColor[sku.grade] || "bg-white/10 text-white/60"}`}>{sku.grade || "?"}</Badge>
              {sku.sku}
            </div>
          </td>
          <td className="py-2 px-2 text-center"><Badge className={`text-xs ${healthBadge[sku.health] || ""}`}>{sku.health?.toUpperCase()}</Badge></td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.available}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{fmt(sku.capital)}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.velocity?.toFixed(1)}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.daysLeft >= 999 ? "-" : sku.daysLeft}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{sku.soldMtd}</td>
          <td className="py-2 px-2 text-right text-muted-foreground">{fmt(sku.revMtd)}</td>
        </tr>
      ))}
    </>
  );
}
