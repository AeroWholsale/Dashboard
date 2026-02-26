import * as XLSX from "xlsx";
import { parseSku, mapChannel } from "./sku";
import type { InsertDailySale, InsertOrderPnl, InsertInventory, InsertChannelSale } from "@shared/schema";

export type ReportType = "daily_sales" | "order_pnl" | "inventory" | "channel_sales" | "unknown";

export function detectReportType(filename: string): ReportType {
  const lower = filename.toLowerCase().replace(/[_\s-]+/g, "");
  if (lower.includes("productquantitysold") || lower.includes("quantitysoldbyproductbyday") || lower.includes("quantitysoldbyproduct")) return "daily_sales";
  if (lower.includes("profitbyorderdetail")) return "order_pnl";
  if (lower.includes("inventorybyproductdetail") || lower.includes("inventoryproductdetailreport")) return "inventory";
  if (lower.includes("productqtybychanneldetail")) return "channel_sales";
  return "unknown";
}

function parseNumeric(val: any): string {
  if (val === null || val === undefined || val === "") return "0";
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[,$]/g, ""));
  return isNaN(n) ? "0" : n.toFixed(2);
}

function parseInt2(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "number" ? Math.round(val) : parseInt(String(val).replace(/[,$]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) return val.toISOString().substring(0, 10);
    return null;
  }
  if (typeof val === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + val * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return null;
}

export function parseDailySalesXlsx(buffer: Buffer): { rows: InsertDailySale[]; dateRange: string } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

  const rows: InsertDailySale[] = [];
  let minDate = "9999-99-99";
  let maxDate = "0000-00-00";

  for (const row of data) {
    const shipDate = parseDate(row["Ship Date"]);
    const sku = String(row["SKU"] || "").trim();
    if (!shipDate || !sku) continue;

    if (shipDate < minDate) minDate = shipDate;
    if (shipDate > maxDate) maxDate = shipDate;

    rows.push({
      shipDate,
      sku,
      productName: String(row["Product Name"] || "").trim(),
      orders: parseInt2(row["Orders"]),
      qtySold: parseInt2(row["Qty Sold"]),
      subtotal: parseNumeric(row["SubTotal"]),
      totalSales: parseNumeric(row["Total Sales"]),
      availableQty: parseInt2(row["Available Qty"]),
    });
  }

  const deduped = new Map<string, InsertDailySale>();
  for (const row of rows) {
    const key = `${row.shipDate}|${row.sku}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.orders = (existing.orders || 0) + (row.orders || 0);
      existing.qtySold = (existing.qtySold || 0) + (row.qtySold || 0);
      existing.subtotal = String(parseFloat(existing.subtotal || "0") + parseFloat(row.subtotal || "0"));
      existing.totalSales = String(parseFloat(existing.totalSales || "0") + parseFloat(row.totalSales || "0"));
    } else {
      deduped.set(key, { ...row });
    }
  }

  return { rows: Array.from(deduped.values()), dateRange: rows.length > 0 ? `${minDate} to ${maxDate}` : "none" };
}

export function parseOrderPnlXlsx(buffer: Buffer): { rows: InsertOrderPnl[]; dateRange: string } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

  const rows: InsertOrderPnl[] = [];
  let minDate = "9999-99-99";
  let maxDate = "0000-00-00";

  for (const row of data) {
    const shipDate = parseDate(row["Ship Date"]);
    const orderId = String(row["Order #"] || "").trim();
    if (!shipDate || !orderId) continue;

    if (shipDate < minDate) minDate = shipDate;
    if (shipDate > maxDate) maxDate = shipDate;

    const channelRaw = String(row["Channel"] || "").trim();
    const company = String(row["Company"] || "").trim();
    const channel = mapChannel(channelRaw, company);

    rows.push({
      orderId,
      orderDate: parseDate(row["Order Date"]),
      shipDate,
      channelRaw,
      company,
      channel,
      qty: parseInt2(row["Qty"]),
      subtotal: parseNumeric(row["SubTotal"]),
      grandTotal: parseNumeric(row["Grand Total"]),
      itemsCost: parseNumeric(row["Items Cost"]),
      shippingCost: parseNumeric(row["Shipping Cost"]),
      commission: parseNumeric(row["Commission"]),
      transactionFee: parseNumeric(row["Transaction Fee"]),
      postingFee: parseNumeric(row["Posting Fee"]),
      totalFees: parseNumeric(row["Total Fees"]),
      accrualProfit: parseNumeric(row["Accrual Profit"]),
      cashProfit: parseNumeric(row["Cash Profit"]),
      accrualMargin: parseNumeric(row["Accrual Profit Margin(%)"]),
    });
  }

  return { rows, dateRange: rows.length > 0 ? `${minDate} to ${maxDate}` : "none" };
}

export function parseInventoryXlsx(buffer: Buffer): { rows: InsertInventory[]; count: number } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

  const rows: InsertInventory[] = [];
  const today = new Date().toISOString().substring(0, 10);

  for (const row of data) {
    const warehouse = String(row["Warehouse"] || "").trim();
    if (warehouse !== "AW Main") continue;

    const sku = String(row["SKU"] || "").trim();
    if (!sku) continue;

    const parsed = parseSku(sku);

    rows.push({
      sku,
      productName: String(row["Product Name"] || "").trim(),
      warehouse,
      physical: parseInt2(row["Physical"]),
      reserved: parseInt2(row["Reserved"]),
      available: parseInt2(row["Available"]),
      cost: parseNumeric(row["Cost"]),
      value: parseNumeric(row["Value"]),
      listPrice: parseNumeric(row["List Price"]),
      sitePrice: parseNumeric(row["Site Price"]),
      lastReceived: String(row["Last Received"] || ""),
      prefix: parsed.prefix,
      category: parsed.category,
      grade: parsed.grade,
      bucket: parsed.bucket,
      productFamily: parsed.productFamily,
      snapshotDate: today,
    });
  }

  return { rows, count: rows.length };
}

export function parseChannelSalesXlsx(buffer: Buffer): { rows: InsertChannelSale[]; count: number } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

  const rows: InsertChannelSale[] = [];
  const today = new Date().toISOString().substring(0, 10);

  const channelPrefixes = [
    "Amazon", "BackMarket", "eBayOrder", "FBA", "Local_Store",
    "NewEggdotcom", "Tanga", "Walmart_Marketplace", "Website", "Wholesale"
  ];

  for (const row of data) {
    const sku = String(row["Product"] || "").trim();
    if (!sku) continue;

    const channelData: Record<string, { units: number; orders: number; sales: number }> = {};

    for (const ch of channelPrefixes) {
      const units = parseInt2(row[`${ch}_Units`]);
      const orders = parseInt2(row[`${ch}_Orders`]);
      const sales = parseNumeric(row[`${ch}_Sales`]);
      if (units > 0 || orders > 0) {
        channelData[ch] = { units, orders, sales: parseFloat(sales) };
      }
    }

    rows.push({
      reportDate: today,
      sku,
      productName: String(row["ProductName"] || "").trim(),
      totalUnits: parseInt2(row["TotalUnits"]),
      totalOrders: parseInt2(row["TotalOrders"]),
      totalSales: parseNumeric(row["TotalSales"]),
      channelData,
    });
  }

  return { rows, count: rows.length };
}
