import { useState } from "react";
import { usePnL } from "@/hooks/use-dashboard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from "recharts";
import { Download } from "lucide-react";
import { downloadCsv, todayStr } from "@/lib/csv";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmt2 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

export default function PnL() {
  const { data, isLoading } = usePnL();
  const [selectedChannel, setSelectedChannel] = useState<any>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">P&L / Channels</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                downloadCsv(data?.channelPnl || [], [
                  { key: "channel", label: "Channel" },
                  { key: "revenue", label: "Revenue" },
                  { key: "pctOfTotal", label: "%" },
                  { key: "profit", label: "Profit" },
                  { key: "margin", label: "Margin" },
                  { key: "fees", label: "Fees" },
                  { key: "feeRate", label: "Fee Rate" },
                  { key: "orders", label: "Orders" },
                  { key: "aov", label: "AOV" },
                ], `channel-pnl-${todayStr()}.csv`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              data-testid="btn-export-channel-pnl"
            >
              <Download className="w-3.5 h-3.5" />
              Export Channel P&L
            </button>
            <button
              onClick={() => {
                downloadCsv(data?.dailyBreakdown || [], [
                  { key: "date", label: "Date" },
                  { key: "revenue", label: "Revenue" },
                  { key: "profit", label: "Profit" },
                  { key: "margin", label: "Margin" },
                  { key: "fees", label: "Fees" },
                  { key: "orders", label: "Orders" },
                  { key: "units", label: "Units" },
                ], `daily-pnl-${todayStr()}.csv`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              data-testid="btn-export-daily-pnl"
            >
              <Download className="w-3.5 h-3.5" />
              Export Daily P&L
            </button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Revenue", val: data?.kpis.revenue, isCurrency: true },
            { label: "Profit", val: data?.kpis.profit, isCurrency: true, color: (data?.kpis.profit || 0) >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Margin", val: data?.kpis.margin, suffix: "%" },
            { label: `Fees (${data?.kpis.feeRate || 0}%)`, val: data?.kpis.totalFees, isCurrency: true, color: "text-amber-400" },
            { label: "Orders", val: data?.kpis.orders },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-lg bg-[#0c1220] border border-[#1a2844]">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <>
                  <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${(s as any).color || "text-white"}`}>
                    {s.isCurrency ? fmt(s.val || 0) : s.suffix ? `${s.val || 0}${s.suffix}` : (s.val || 0).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Channel P&L</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-48 m-4" /> : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10 text-xs uppercase">
                      <th className="text-left py-3 px-4">Channel</th>
                      <th className="text-right py-3 px-2">Revenue</th>
                      <th className="text-right py-3 px-2">% Total</th>
                      <th className="text-right py-3 px-2">Profit</th>
                      <th className="text-right py-3 px-2">Margin%</th>
                      <th className="text-right py-3 px-2">Fees</th>
                      <th className="text-right py-3 px-2">Fee Rate</th>
                      <th className="text-right py-3 px-2">Orders</th>
                      <th className="text-right py-3 px-2">AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.channelPnl || []).length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No P&L data. Upload ProfitByOrderDetails to see channel breakdown.</td></tr>
                    ) : (data?.channelPnl || []).map((ch: any) => (
                      <tr key={ch.channel} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedChannel(ch)}>
                        <td className="py-3 px-4 font-medium text-white">{ch.channel}</td>
                        <td className="py-3 px-2 text-right">{fmt(ch.revenue)}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{ch.pctOfTotal?.toFixed(1)}%</td>
                        <td className="py-3 px-2 text-right"><span className={ch.profit >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(ch.profit)}</span></td>
                        <td className="py-3 px-2 text-right"><span className={ch.margin >= 15 ? "text-emerald-400" : ch.margin >= 0 ? "text-amber-400" : "text-red-400"}>{ch.margin?.toFixed(1)}%</span></td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{fmt(ch.fees)}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{ch.feeRate?.toFixed(1)}%</td>
                        <td className="py-3 px-2 text-right">{ch.orders}</td>
                        <td className="py-3 px-2 text-right">{fmt2(ch.aov)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardHeader><CardTitle className="text-sm text-muted-foreground">14-Month Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.revenueTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#1a2844", borderRadius: "8px" }} formatter={(v: number) => [fmt(v), "Revenue"]} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {(data?.revenueTrend || []).map((_: any, i: number, arr: any[]) => (
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

        <Card className="border-[#1a2844] bg-[#0c1220]">
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Daily Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <Skeleton className="h-48 m-4" /> : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-white/10 text-xs uppercase">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-right py-3 px-2">Revenue</th>
                      <th className="text-right py-3 px-2">Profit</th>
                      <th className="text-right py-3 px-2">Margin%</th>
                      <th className="text-right py-3 px-2">Fees</th>
                      <th className="text-right py-3 px-2">Orders</th>
                      <th className="text-right py-3 px-2">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.dailyBreakdown || []).map((d: any) => (
                      <tr key={d.date} className="border-b border-white/5">
                        <td className="py-3 px-4 text-white">{d.date}</td>
                        <td className="py-3 px-2 text-right">{fmt(d.revenue)}</td>
                        <td className="py-3 px-2 text-right"><span className={d.profit >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(d.profit)}</span></td>
                        <td className="py-3 px-2 text-right">{d.margin?.toFixed(1)}%</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">{fmt(d.fees)}</td>
                        <td className="py-3 px-2 text-right">{d.orders}</td>
                        <td className="py-3 px-2 text-right">{d.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedChannel} onOpenChange={() => setSelectedChannel(null)}>
          <DialogContent className="max-w-2xl bg-[#111827] border-[#1a2844]">
            <DialogHeader>
              <DialogTitle>Channel Detail: {selectedChannel?.channel}</DialogTitle>
            </DialogHeader>
            {selectedChannel && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Revenue", value: fmt(selectedChannel.revenue) },
                    { label: "Profit", value: fmt(selectedChannel.profit), color: selectedChannel.profit >= 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "Margin", value: `${selectedChannel.margin?.toFixed(1)}%` },
                    { label: "Orders", value: selectedChannel.orders },
                    { label: "AOV", value: fmt2(selectedChannel.aov) },
                    { label: "Profit/Order", value: fmt2(selectedChannel.profitPerOrder) },
                    { label: "Cost", value: fmt(selectedChannel.cost) },
                    { label: "Fees", value: fmt(selectedChannel.fees) },
                    { label: "Fee Rate", value: `${selectedChannel.feeRate?.toFixed(1)}%` },
                  ].map(c => (
                    <div key={c.label} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                      <p className={`text-sm font-bold ${(c as any).color || "text-white"}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-[200px]">
                  <p className="text-xs text-muted-foreground mb-2">Profit Waterfall</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Revenue", value: selectedChannel.revenue },
                      { name: "Cost", value: -selectedChannel.cost },
                      { name: "Fees", value: -selectedChannel.fees },
                      { name: "Profit", value: selectedChannel.profit },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={11} tickFormatter={(v) => `$${(Math.abs(v) / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#1a2844" }} formatter={(v: number) => [fmt(Math.abs(v)), ""]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill="#3b82f6" />
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#10b981" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
