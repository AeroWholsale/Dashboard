import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, Package, Thermometer, RefreshCcw, ShoppingCart, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface SearchResult {
  sku: string;
  displayName: string;
  category: string;
  grade: string;
  available: number;
  soldMtd: number;
  soldLm: number;
  velocity: number;
  daysLeft: number;
  health: string;
  temperature: string;
  cost: number;
  revMtd: number;
  screens: string[];
  inInventory: boolean;
}

interface ProductDetail {
  sku: string;
  displayName: string;
  category: string;
  grade: string;
  bucket: string;
  available: number;
  physical: number;
  reserved: number;
  cost: number;
  listPrice: number;
  sitePrice: number;
  value: number;
  velocity: number;
  daysLeft: number;
  soldMtd: number;
  revMtd: number;
  soldLm: number;
  revLm: number;
  avgPrice: number;
  dailyHistory: { date: string; qty: number; revenue: number }[];
  recentOrders: { orderId: string; shipDate: string; channel: string; revenue: number; profit: number; qty: number }[];
  inInventory: boolean;
  warehouse: string | null;
  lastReceived: string | null;
}

const SCREEN_MAP: Record<string, { href: string; icon: typeof Package; color: string }> = {
  Reorder: { href: "/reorder", icon: ShoppingCart, color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  Temperature: { href: "/temperature", icon: Thermometer, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  Reprice: { href: "/reprice", icon: RefreshCcw, color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  Inventory: { href: "/inventory", icon: Package, color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
};

const HEALTH_COLORS: Record<string, string> = {
  dead: "bg-red-500/20 text-red-400 border-red-500/30",
  critical: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  low: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  overstocked: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const TEMP_COLORS: Record<string, string> = {
  HOT: "bg-red-500/20 text-red-400",
  RISING: "bg-orange-500/20 text-orange-400",
  STABLE: "bg-emerald-500/20 text-emerald-400",
  FALLING: "bg-blue-500/20 text-blue-400",
  DEAD: "bg-zinc-500/20 text-zinc-400",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setIsOpen(data.length > 0 || q.trim().length >= 2);
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const openProductDetail = async (sku: string) => {
    setModalLoading(true);
    setModalOpen(true);
    setIsOpen(false);
    try {
      const res = await fetch(`/api/product/${encodeURIComponent(sku)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProduct(data);
      }
    } catch (e) {
      console.error("Product detail failed:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const navigateToScreen = (screen: string, sku: string) => {
    const info = SCREEN_MAP[screen];
    if (info) {
      setModalOpen(false);
      setIsOpen(false);
      setQuery("");
      setLocation(`${info.href}?search=${encodeURIComponent(sku)}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative hidden sm:block">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        {isLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />}
        {!isLoading && query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search all SKUs..."
          className="pl-9 pr-8 w-[280px] bg-white/5 border-white/10 focus-visible:ring-primary/20 transition-all focus-visible:bg-white/10"
          data-testid="input-global-search"
        />

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full mt-2 right-0 w-[420px] max-h-[480px] overflow-y-auto rounded-lg border border-border/60 bg-card shadow-2xl shadow-black/40 z-50"
            data-testid="dropdown-search-results"
          >
            {results.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="text-no-results">
                No results found for "{query}"
              </div>
            )}

            {results.map((r) => (
              <button
                key={r.sku}
                onClick={() => openProductDetail(r.sku)}
                className="w-full text-left px-4 py-3 border-b border-border/30 hover:bg-white/5 transition-colors group"
                data-testid={`search-result-${r.sku}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {r.displayName}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{r.sku}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.inInventory && r.health && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${HEALTH_COLORS[r.health] || ""}`}>
                        {r.health.toUpperCase()}
                      </span>
                    )}
                    {r.temperature && r.temperature !== "STABLE" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEMP_COLORS[r.temperature] || ""}`}>
                        {r.temperature}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{r.category}</span>
                  {r.inInventory && <span>Avail: <span className="text-foreground font-medium">{r.available}</span></span>}
                  <span>MTD: <span className="text-foreground font-medium">{r.soldMtd}</span></span>
                  <span>LM: <span className="text-foreground font-medium">{r.soldLm}</span></span>
                </div>

                {r.screens.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {r.screens.map(s => {
                      const info = SCREEN_MAP[s];
                      if (!info) return null;
                      return (
                        <span
                          key={s}
                          onClick={(e) => { e.stopPropagation(); navigateToScreen(s, r.sku); }}
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 ${info.color}`}
                          data-testid={`badge-screen-${s.toLowerCase()}-${r.sku}`}
                        >
                          <info.icon className="h-3 w-3" />
                          {s}
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {modalLoading ? "Loading..." : selectedProduct?.displayName || "Product Detail"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct ? (
                <span className="font-mono text-xs">{selectedProduct.sku}</span>
              ) : ""}
            </DialogDescription>
          </DialogHeader>

          {modalLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!modalLoading && selectedProduct && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBlock label="Category" value={selectedProduct.category} />
                <StatBlock label="Grade" value={selectedProduct.grade || "—"} />
                <StatBlock label="Bucket" value={selectedProduct.bucket} />
                <StatBlock label="Warehouse" value={selectedProduct.warehouse || "—"} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBlock label="Available" value={String(selectedProduct.available)} highlight />
                <StatBlock label="Physical" value={String(selectedProduct.physical)} />
                <StatBlock label="Reserved" value={String(selectedProduct.reserved)} />
                <StatBlock label="Days of Stock" value={selectedProduct.daysLeft > 900 ? "∞" : String(selectedProduct.daysLeft)} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBlock label="Sold MTD" value={String(selectedProduct.soldMtd)} highlight />
                <StatBlock label="Rev MTD" value={`$${selectedProduct.revMtd.toLocaleString()}`} />
                <StatBlock label="Sold Last Month" value={String(selectedProduct.soldLm)} />
                <StatBlock label="Rev Last Month" value={`$${selectedProduct.revLm.toLocaleString()}`} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBlock label="Velocity/Day" value={String(selectedProduct.velocity)} />
                <StatBlock label="Avg Price" value={selectedProduct.avgPrice > 0 ? `$${selectedProduct.avgPrice}` : "—"} />
                <StatBlock label="Cost" value={selectedProduct.cost > 0 ? `$${selectedProduct.cost}` : "—"} />
                <StatBlock label="Capital" value={`$${selectedProduct.value.toLocaleString()}`} />
              </div>

              {selectedProduct.dailyHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">30-Day Sales History</h3>
                  <div className="flex items-end gap-[2px] h-16">
                    {selectedProduct.dailyHistory.map((d, i) => {
                      const maxQty = Math.max(...selectedProduct.dailyHistory.map(x => x.qty), 1);
                      const height = (d.qty / maxQty) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-primary/60 rounded-t-sm hover:bg-primary transition-colors"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${d.date}: ${d.qty} units, $${d.revenue.toFixed(0)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{selectedProduct.dailyHistory[0]?.date}</span>
                    <span>{selectedProduct.dailyHistory[selectedProduct.dailyHistory.length - 1]?.date}</span>
                  </div>
                </div>
              )}

              {selectedProduct.recentOrders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent Orders</h3>
                  <div className="border border-border/40 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-white/5">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Order</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Channel</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.recentOrders.map((o) => (
                          <tr key={o.orderId} className="border-b border-border/20 hover:bg-white/5">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{o.orderId.slice(0, 12)}...</td>
                            <td className="px-3 py-1.5">{o.shipDate}</td>
                            <td className="px-3 py-1.5">{o.channel}</td>
                            <td className="px-3 py-1.5 text-right">{o.qty}</td>
                            <td className="px-3 py-1.5 text-right">${o.revenue.toFixed(2)}</td>
                            <td className={`px-3 py-1.5 text-right ${o.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ${o.profit.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">View on:</span>
                {Object.entries(SCREEN_MAP).map(([name, info]) => (
                  <button
                    key={name}
                    onClick={() => navigateToScreen(name, selectedProduct.sku)}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:opacity-80 transition-opacity ${info.color}`}
                    data-testid={`modal-nav-${name.toLowerCase()}`}
                  >
                    <info.icon className="h-3 w-3" />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-white/5 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 font-mono ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
