import { useState } from "react";
import { useDailyPulse, useChannelBreakdown } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Activity, ShoppingBag, Package, Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from "recharts";

const fmt = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
const fmtPct = (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateLabel(raw: string): string {
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-');
    return `${MONTHS_SHORT[parseInt(m) - 1]} ${y.slice(2)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [, m, d] = raw.split('-');
    return `${MONTHS_SHORT[parseInt(m) - 1]} ${parseInt(d)}`;
  }
  return raw;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2844', color: '#e2e8f0', border: '1px solid #2d3f5f', padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
      <p style={{ color: '#e2e8f0', marginBottom: 4 }}>{fmtDateLabel(label)}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: '#e2e8f0' }}>{fmt(p.payload?.actualRevenue ?? p.value)}</p>
      ))}
    </div>
  );
}

function KpiCard({ title, value, icon, loading, onClick }: { title: string; value: string; icon: any; loading?: boolean; onClick?: () => void }) {
  return (
    <div
      className="p-4 rounded-lg bg-[#0c1220] border border-[#1a2844] cursor-pointer hover:border-blue-500/40 transition-colors"
      onClick={onClick}
      data-testid={`card-kpi-${title.toLowerCase().replace(/\s/g, "-")}`}
    >
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">{icon}{title}</div>
          <p className="text-2xl font-bold text-white">{value}</p>
        </>
      )}
    </div>
  );
}

function DeltaCell({ value }: { value: number }) {
  return (
    <span className={`font-semibold ${value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {fmtPct(value)}
    </span>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useDailyPulse();
  const { data: channelData } = useChannelBreakdown();
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

  const metricTitles: Record<string, string> = {
    revenue: "Revenue by Channel",
    profit: "Profit by Channel",
    margin: "Margin by Channel",
    orders: "Orders by Channel",
    units: "Units by Channel",
  };

  const sortedChannelData = (channelData || []).slice().sort((a: any, b: any) => {
    if (!activeMetric) return 0;
    const key = activeMetric === "margin" ? "margin" : activeMetric;
    return (b[key] ?? 0) - (a[key] ?? 0);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Daily Pulse</h1>
          <div className="flex gap-2">
            <button onClick={() => downloadCsv(data?.comparisons || [], [{ key: "metric", label: "Metric" }, { key: "mtd", label: "MTD" }, { key: "priorMonthMtd", label: "Prior Month MTD" }, { key: "priorMonthDelta", label: "PM Delta%" }, { key: "smlyMtd", label: "SMLY MTD" }, { key: "smlyDelta", label: "SMLY Delta%" }, { key: "ytd", label: "YTD" }, { key: "priorYtd", label: "Prior YTD" }, { key: "ytdDelta", label: "YTD Delta%" }], `daily-pulse-comparison-${todayStr()}.csv`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" data-testid="btn-export-comparison">
              <Download className="w-3.5 h-3.5" />
              Export Comparison
            </button>
            <button onClick={() => downloadCsv(data?.dailyRevenue || [], [{ key: "date", label: "Date" }, { key: "revenue", label: "Revenue" }], `daily-pulse-trend-${todayStr()}.csv`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" data-testid="btn-export-daily-trend">
              <Download className="w-3.5 h-3.5" />
              Export Daily Trend
            </button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Revenue MTD" value={data ? fmt(data.kpis.revenue) : "$0"} icon={<DollarSign className="w-4 h-4" />} loading={isLoading} onClick={() => setActiveMetric("revenue")} />
          <KpiCard title="Profit MTD" value={data ? fmt(data.kpis.profit) : "$0"} icon={<TrendingUp className="w-4 h-4" />} loading={isLoading} onClick={() => setActiveMetric("profit")} />
          <KpiCard title="Margin" value={data ? `${data.kpis.margin}%` : "0%"} icon={<Activity className="w-4 h-4" />} loading={isLoading} onClick={() => setActiveMetric("margin")} />
          <KpiCard title="Orders" value={data ? data.kpis.orders.toLocaleString() : "0"} icon={<ShoppingBag className="w-4 h-4" />} loading={isLoading} onClick={() => setActiveMetric("orders")} />
          <KpiCard title="Units" value={data ? data.kpis.units.toLocaleString() : "0"} icon={<Package className="w-4 h-4" />} loading={isLoading} onClick={() => setActiveMetric("units")} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-[#1a2844] bg-[#0c1220]">
            <CardHeader><CardTitle className="text-sm text-muted-foreground">14-Day Revenue</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const raw = data?.dailyRevenue || [];
                      const maxRev = Math.max(...raw.map((r: any) => r.revenue), 1);
                      const minBarPct = 0.02;
                      const chartData = raw.map((r: any) => ({
                        ...r,
                        displayRevenue: Math.max(r.revenue, maxRev * minBarPct),
                        actualRevenue: r.revenue,
                      }));
                      return (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(s: string) => { const [,m,d] = s.split('-'); return `${MONTHS_SHORT[parseInt(m)-1]} ${parseInt(d)}`; }} />
                          <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip content={<CustomTooltip />} cursor={false} />
                          <Bar dataKey="displayRevenue" radius={[4, 4, 0, 0]} activeBar={false}>
                            {chartData.map((_: any, i: number, arr: any[]) => (
                              <Cell key={i} fill={i === arr.length - 1 ? "#10b981" : "#3b82f6"} />
                            ))}
                            <LabelList dataKey="actualRevenue" position="top" formatter={(v: number) => v > 1000 ? `$${(v / 1000).toFixed(0)}k` : v > 0 ? `$${v.toFixed(0)}` : ""} fill="#999" fontSize={10} />
                          </Bar>
                        </BarChart>
                      );
                    })()}
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#1a2844] bg-[#0c1220]">
            <CardHeader><CardTitle className="text-sm text-muted-foreground">14-Month Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.monthlyRevenue || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(s) => fmtDateLabel(s)} />
                      <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]} activeBar={false}>
                        {(data?.monthlyRevenue || []).map((_: any, i: number, arr: any[]) => (
                          <Cell key={i} fill={i === arr.length - 1 ? "#10b981" : "#3b82f6"} />
                        ))}
                        <LabelList dataKey="revenue" position="top" formatter={(v: number) => v > 1000 ? `$${(v / 1000).toFixed(0)}k` : ""} fill="#999" fontSize={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Performance Comparisons</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10">
                      <th className="text-left py-2 pr-4"></th>
                      <th className="text-right py-2 px-3">MTD</th>
                      <th className="text-right py-2 px-3">Prior Month MTD</th>
                      <th className="text-right py-2 px-3">Delta %</th>
                      <th className="text-right py-2 px-3">SMLY MTD</th>
                      <th className="text-right py-2 px-3">Delta %</th>
                      <th className="text-right py-2 px-3">YTD</th>
                      <th className="text-right py-2 px-3">Prior YTD</th>
                      <th className="text-right py-2 px-3">Delta %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.comparisons || []).map((c: any) => (
                      <tr key={c.metric} className="border-b border-white/5">
                        <td className="py-3 pr-4 font-medium text-white">{c.metric}</td>
                        <td className="py-3 px-3 text-right text-white font-medium">{c.metric === "Orders" ? c.mtd.toLocaleString() : fmt(c.mtd)}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{c.metric === "Orders" ? c.priorMonthMtd.toLocaleString() : fmt(c.priorMonthMtd)}</td>
                        <td className="py-3 px-3 text-right"><DeltaCell value={c.priorMonthDelta} /></td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{c.metric === "Orders" ? c.smlyMtd.toLocaleString() : fmt(c.smlyMtd)}</td>
                        <td className="py-3 px-3 text-right"><DeltaCell value={c.smlyDelta} /></td>
                        <td className="py-3 px-3 text-right text-white">{c.metric === "Orders" ? c.ytd.toLocaleString() : fmt(c.ytd)}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground">{c.metric === "Orders" ? c.priorYtd.toLocaleString() : fmt(c.priorYtd)}</td>
                        <td className="py-3 px-3 text-right"><DeltaCell value={c.ytdDelta} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!activeMetric} onOpenChange={() => setActiveMetric(null)}>
          <DialogContent className="max-w-2xl bg-[#111827] border-[#1a2844]">
            <DialogHeader><DialogTitle>{activeMetric ? metricTitles[activeMetric] : "Channel Breakdown"}</DialogTitle></DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/10">
                    <th className="text-left py-2">Channel</th>
                    {activeMetric === "revenue" && <><th className="text-right py-2">Revenue</th><th className="text-right py-2">% of Total</th></>}
                    {activeMetric === "profit" && <><th className="text-right py-2">Profit</th><th className="text-right py-2">Margin%</th></>}
                    {activeMetric === "margin" && <><th className="text-right py-2">Revenue</th><th className="text-right py-2">Profit</th><th className="text-right py-2">Margin%</th></>}
                    {activeMetric === "orders" && <><th className="text-right py-2">Orders</th><th className="text-right py-2">% of Total</th><th className="text-right py-2">AOV</th></>}
                    {activeMetric === "units" && <><th className="text-right py-2">Units</th><th className="text-right py-2">% of Total</th></>}
                  </tr>
                </thead>
                <tbody>
                  {sortedChannelData.map((ch: any) => (
                    <tr key={ch.channel} className="border-b border-white/5">
                      <td className="py-2 font-medium text-white">{ch.channel}</td>
                      {activeMetric === "revenue" && <>
                        <td className="py-2 text-right">{fmt(ch.revenue)}</td>
                        <td className="py-2 text-right text-muted-foreground">{ch.pctOfTotal?.toFixed(1)}%</td>
                      </>}
                      {activeMetric === "profit" && <>
                        <td className="py-2 text-right">{fmt(ch.profit)}</td>
                        <td className="py-2 text-right">
                          <span className={ch.margin >= 15 ? "text-emerald-400" : ch.margin >= 0 ? "text-amber-400" : "text-red-400"}>{ch.margin?.toFixed(1)}%</span>
                        </td>
                      </>}
                      {activeMetric === "margin" && <>
                        <td className="py-2 text-right">{fmt(ch.revenue)}</td>
                        <td className="py-2 text-right">{fmt(ch.profit)}</td>
                        <td className="py-2 text-right">
                          <span className={ch.margin >= 15 ? "text-emerald-400" : ch.margin >= 0 ? "text-amber-400" : "text-red-400"}>{ch.margin?.toFixed(1)}%</span>
                        </td>
                      </>}
                      {activeMetric === "orders" && <>
                        <td className="py-2 text-right">{ch.orders}</td>
                        <td className="py-2 text-right text-muted-foreground">{ch.pctOfTotal?.toFixed(1)}%</td>
                        <td className="py-2 text-right">{ch.aov ? fmt(ch.aov) : "—"}</td>
                      </>}
                      {activeMetric === "units" && <>
                        <td className="py-2 text-right">{ch.units}</td>
                        <td className="py-2 text-right text-muted-foreground">{ch.pctOfTotal?.toFixed(1)}%</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        {!isLoading && (!data || data.kpis.orders === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg mb-2">No data yet</p>
            <p className="text-sm">Upload your XLSX reports from the Data / Upload page to see your dashboard come to life.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
