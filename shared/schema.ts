import { pgTable, text, serial, integer, timestamp, numeric, date, jsonb, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  shipDate: date("ship_date").notNull(),
  sku: text("sku").notNull(),
  productName: text("product_name"),
  orders: integer("orders").notNull().default(0),
  qtySold: integer("qty_sold").notNull().default(0),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  availableQty: integer("available_qty").default(0),
}, (table) => [
  uniqueIndex("daily_sales_date_sku_idx").on(table.shipDate, table.sku),
]);

export const orderPnl = pgTable("order_pnl", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderDate: date("order_date"),
  shipDate: date("ship_date").notNull(),
  channelRaw: text("channel_raw"),
  company: text("company"),
  channel: text("channel").notNull(),
  qty: integer("qty").notNull().default(0),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  itemsCost: numeric("items_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  commission: numeric("commission", { precision: 12, scale: 2 }).notNull().default("0"),
  transactionFee: numeric("transaction_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  postingFee: numeric("posting_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  totalFees: numeric("total_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  accrualProfit: numeric("accrual_profit", { precision: 12, scale: 2 }).notNull().default("0"),
  cashProfit: numeric("cash_profit", { precision: 12, scale: 2 }).notNull().default("0"),
  accrualMargin: numeric("accrual_margin", { precision: 8, scale: 2 }).default("0"),
}, (table) => [
  uniqueIndex("order_pnl_order_id_idx").on(table.orderId),
]);

export const inventoryCurrent = pgTable("inventory_current", {
  sku: text("sku").primaryKey(),
  productName: text("product_name"),
  warehouse: text("warehouse"),
  physical: integer("physical").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  available: integer("available").notNull().default(0),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull().default("0"),
  value: numeric("value", { precision: 12, scale: 2 }).notNull().default("0"),
  listPrice: numeric("list_price", { precision: 10, scale: 2 }),
  sitePrice: numeric("site_price", { precision: 10, scale: 2 }),
  lastReceived: text("last_received"),
  prefix: text("prefix"),
  category: text("category"),
  grade: text("grade"),
  bucket: text("bucket"),
  productFamily: text("product_family"),
  snapshotDate: date("snapshot_date"),
});

export const channelSales = pgTable("channel_sales", {
  id: serial("id").primaryKey(),
  reportDate: date("report_date").notNull(),
  sku: text("sku").notNull(),
  productName: text("product_name"),
  totalUnits: integer("total_units").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  channelData: jsonb("channel_data"),
}, (table) => [
  uniqueIndex("channel_sales_date_sku_idx").on(table.reportDate, table.sku),
]);

export const productNames = pgTable("product_names", {
  sku: text("sku").primaryKey(),
  displayName: text("display_name").notNull(),
  nameSource: text("name_source").notNull(),
});

export const emailFetchLog = pgTable("email_fetch_log", {
  id: serial("id").primaryKey(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  daysBack: integer("days_back"),
  emailsScanned: integer("emails_scanned").default(0),
  reportsImported: integer("reports_imported").default(0),
  status: text("status").notNull(),
});

export const insertDailySalesSchema = createInsertSchema(dailySales).omit({ id: true });
export const insertOrderPnlSchema = createInsertSchema(orderPnl).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventoryCurrent);
export const insertChannelSalesSchema = createInsertSchema(channelSales).omit({ id: true });

export type DailySale = typeof dailySales.$inferSelect;
export type OrderPnlRow = typeof orderPnl.$inferSelect;
export type InventoryItem = typeof inventoryCurrent.$inferSelect;
export type ChannelSale = typeof channelSales.$inferSelect;
export type InsertDailySale = z.infer<typeof insertDailySalesSchema>;
export type InsertOrderPnl = z.infer<typeof insertOrderPnlSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertChannelSale = z.infer<typeof insertChannelSalesSchema>;
