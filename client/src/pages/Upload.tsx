import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDataStatus } from "@/hooks/use-dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle, Trash2, Database, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Upload() {
  const { data: status, isLoading } = useDataStatus();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [fetchingEmail, setFetchingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fetchEmailReports = useCallback(async () => {
    setFetchingEmail(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/fetch-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Email fetch failed");
      setEmailResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/data-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      if (data.reportsImported > 0) {
        toast({ title: "Email reports imported", description: `${data.reportsImported} report(s) imported from ${data.emailsScanned} emails` });
      } else {
        toast({ title: "No new reports", description: `Scanned ${data.emailsScanned} emails, no new reports found` });
      }
    } catch (err: any) {
      setEmailResult({ error: err.message });
      toast({ title: "Email fetch failed", description: err.message, variant: "destructive" });
    } finally {
      setFetchingEmail(false);
    }
  }, [queryClient, toast]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResults(prev => [...prev, { filename: file.name, ...data }]);
      queryClient.invalidateQueries({ queryKey: ["/api/data-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      const parts = [];
      if (data.inserted > 0) parts.push(`${data.inserted.toLocaleString()} inserted`);
      if (data.updated > 0) parts.push(`${data.updated.toLocaleString()} updated`);
      if (data.unchanged > 0) parts.push(`${data.unchanged.toLocaleString()} unchanged`);
      toast({ title: "Import complete", description: `${parts.join(', ')} from ${file.name}` });
    } catch (err: any) {
      setResults(prev => [...prev, { filename: file.name, error: err.message }]);
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [queryClient, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => uploadFile(f));
  }, [uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => uploadFile(f));
    e.target.value = "";
  }, [uploadFile]);

  const clearTable = async (table: string) => {
    if (!confirm(`Are you sure you want to clear the ${table} table? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/clear-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table }),
      });
      if (!res.ok) throw new Error("Failed to clear table");
      queryClient.invalidateQueries({ queryKey: ["/api/data-status"] });
      toast({ title: "Table cleared", description: `${table} has been cleared.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const tables = [
    { key: "daily_sales", label: "Daily Sales", desc: "ProductQuantitySoldByDay" },
    { key: "order_pnl", label: "Order P&L", desc: "ProfitByOrderDetails" },
    { key: "inventory_current", label: "Inventory", desc: "InventoryByProductDetail" },
    { key: "channel_sales", label: "Channel Sales", desc: "ProductQtyByChannelDetail" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white" data-testid="text-upload-title">Data / Upload</h1>

        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white">Email Report Pipeline</p>
                  <p className="text-xs text-muted-foreground">Fetch XLSX reports from Gmail (sc-reports@aerowholesale.com)</p>
                </div>
              </div>
              <Button
                onClick={fetchEmailReports}
                disabled={fetchingEmail}
                className="bg-blue-600"
                data-testid="button-fetch-email"
              >
                {fetchingEmail ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" /> Fetch Email Reports</>
                )}
              </Button>
            </div>

            {emailResult && (
              <div className="mt-4 space-y-2">
                {emailResult.error ? (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400" data-testid="text-email-error">{emailResult.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5 text-sm">
                      <span className="text-muted-foreground">Emails scanned: <span className="text-white font-medium">{emailResult.emailsScanned}</span></span>
                      <span className="text-muted-foreground">Reports imported: <span className="text-emerald-400 font-medium">{emailResult.reportsImported}</span></span>
                    </div>
                    {emailResult.reports?.map((r: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                        {r.error ? (
                          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <FileSpreadsheet className="w-3 h-3" />
                            {r.filename}
                            <span className="text-xs text-muted-foreground">({r.reportType})</span>
                          </p>
                          {r.error ? (
                            <p className="text-xs text-red-400">{r.error}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {r.inserted > 0 && <span className="text-emerald-400">{r.inserted.toLocaleString()} inserted</span>}
                              {r.inserted > 0 && r.updated > 0 && ", "}
                              {r.updated > 0 && <span className="text-blue-400">{r.updated.toLocaleString()} updated</span>}
                              {r.dateRange && ` · ${r.dateRange}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div
          data-testid="dropzone-upload"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
            dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input id="file-input" type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={handleFileSelect} data-testid="input-file-upload" />
          <UploadIcon className={`w-12 h-12 mx-auto mb-4 ${dragOver ? "text-blue-400" : "text-muted-foreground"}`} />
          <p className="text-lg font-medium text-white mb-2">
            {uploading ? "Uploading..." : "Drop XLSX files here or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground">
            Auto-detects report type by filename: ProductQuantitySoldByDay, ProfitByOrderDetails, InventoryByProductDetail, ProductQtyByChannelDetail
          </p>
        </div>

        {results.length > 0 && (
          <Card className="border-white/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  {r.error ? (
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      {r.filename}
                    </p>
                    {r.error ? (
                      <p className="text-sm text-red-400">{r.error}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {r.inserted > 0 && <span className="text-emerald-400">{r.inserted.toLocaleString()} inserted</span>}
                        {r.inserted > 0 && r.updated > 0 && ", "}
                        {r.updated > 0 && <span className="text-blue-400">{r.updated.toLocaleString()} updated</span>}
                        {(r.inserted > 0 || r.updated > 0) && r.unchanged > 0 && ", "}
                        {r.unchanged > 0 && <span>{r.unchanged.toLocaleString()} unchanged</span>}
                        {r.dateRange && ` · ${r.dateRange}`}
                        {r.type && ` → ${r.type}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tables.map(t => (
                <div key={t.key} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-muted-foreground mb-1">{t.label}</p>
                  <p className="text-2xl font-bold text-white" data-testid={`text-count-${t.key}`}>
                    {isLoading ? "..." : (status?.[t.key] || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                  {status?.[t.key] > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-red-400 hover:text-red-300 p-0 h-auto"
                      onClick={() => clearTable(t.key)}
                      data-testid={`button-clear-${t.key}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
