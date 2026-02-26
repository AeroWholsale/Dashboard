import { useQuery } from "@tanstack/react-query";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useDailyPulse() {
  return useQuery({
    queryKey: ["/api/dashboard/daily-pulse"],
    queryFn: () => fetchJson("/api/dashboard/daily-pulse"),
    refetchInterval: 60000,
  });
}

export function useReorderQueue(targetMargin: number = 20) {
  return useQuery({
    queryKey: ["/api/dashboard/reorder-queue", targetMargin],
    queryFn: () => fetchJson(`/api/dashboard/reorder-queue?targetMargin=${targetMargin}`),
  });
}

export function useSkuTemperature(category?: string, search?: string) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (search) params.set("search", search);
  const qs = params.toString();
  return useQuery({
    queryKey: ["/api/dashboard/sku-temperature", category, search],
    queryFn: () => fetchJson(`/api/dashboard/sku-temperature${qs ? `?${qs}` : ""}`),
  });
}

export function useRepriceQueue() {
  return useQuery({
    queryKey: ["/api/dashboard/reprice-queue"],
    queryFn: () => fetchJson("/api/dashboard/reprice-queue"),
  });
}

export function usePnL() {
  return useQuery({
    queryKey: ["/api/dashboard/pnl"],
    queryFn: () => fetchJson("/api/dashboard/pnl"),
  });
}

export function useInventory(activeOnly: boolean = true, category?: string, search?: string) {
  const params = new URLSearchParams();
  params.set("activeOnly", String(activeOnly));
  if (category && category !== "All") params.set("category", category);
  if (search) params.set("search", search);
  return useQuery({
    queryKey: ["/api/inventory", activeOnly, category, search],
    queryFn: () => fetchJson(`/api/inventory?${params.toString()}`),
  });
}

export function useDataStatus() {
  return useQuery({
    queryKey: ["/api/data-status"],
    queryFn: () => fetchJson("/api/data-status"),
  });
}

export function useChannelBreakdown() {
  return useQuery({
    queryKey: ["/api/dashboard/daily-pulse/channel-breakdown"],
    queryFn: () => fetchJson("/api/dashboard/daily-pulse/channel-breakdown"),
  });
}
