import { db } from "./db";
import {
  dailySales, orderPnl, inventoryCurrent, channelSales,
  type InsertDailySale, type InsertOrderPnl, type InsertInventory, type InsertChannelSale,
  type DailySale, type OrderPnlRow, type InventoryItem, type ChannelSale
} from "@shared/schema";
import { eq, sql, and, gte, lte, like, desc, asc, inArray } from "drizzle-orm";

export interface UpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface IStorage {
  upsertDailySales(rows: InsertDailySale[]): Promise<UpsertResult>;
  upsertOrderPnl(rows: InsertOrderPnl[]): Promise<UpsertResult>;
  upsertInventory(rows: InsertInventory[]): Promise<UpsertResult>;
  upsertChannelSales(rows: InsertChannelSale[]): Promise<UpsertResult>;
  clearTable(table: "daily_sales" | "order_pnl" | "inventory_current" | "channel_sales"): Promise<void>;
  getTableCounts(): Promise<Record<string, number>>;
}

export class DatabaseStorage implements IStorage {
  async upsertDailySales(rows: InsertDailySale[]): Promise<UpsertResult> {
    if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };

    const uniqueKeys = Array.from(new Set(rows.map(r => `${r.shipDate}|${r.sku}`)));
    const existingKeys = new Set<string>();
    const keyBatchSize = 500;
    for (let i = 0; i < uniqueKeys.length; i += keyBatchSize) {
      const keyBatch = uniqueKeys.slice(i, i + keyBatchSize);
      const conditions = keyBatch.map(k => {
        const [d, s] = [k.substring(0, 10), k.substring(11)];
        return sql`(${dailySales.shipDate} = ${d} AND ${dailySales.sku} = ${s})`;
      });
      const existing = await db.select({ d: dailySales.shipDate, s: dailySales.sku })
        .from(dailySales)
        .where(sql.join(conditions, sql` OR `));
      for (const e of existing) existingKeys.add(`${e.d}|${e.s}`);
    }

    let inserted = 0;
    let updated = 0;
    for (const k of uniqueKeys) {
      if (existingKeys.has(k)) updated++;
      else inserted++;
    }

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(dailySales).values(batch)
        .onConflictDoUpdate({
          target: [dailySales.shipDate, dailySales.sku],
          set: {
            productName: sql`excluded.product_name`,
            orders: sql`excluded.orders`,
            qtySold: sql`excluded.qty_sold`,
            subtotal: sql`excluded.subtotal`,
            totalSales: sql`excluded.total_sales`,
            availableQty: sql`excluded.available_qty`,
          },
        });
    }

    return { inserted, updated, unchanged: 0 };
  }

  async upsertOrderPnl(rows: InsertOrderPnl[]): Promise<UpsertResult> {
    if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };

    const uniqueOrderIds = Array.from(new Set(rows.map(r => r.orderId)));
    const existingIds = new Set<string>();
    const keyBatchSize = 500;
    for (let i = 0; i < uniqueOrderIds.length; i += keyBatchSize) {
      const keyBatch = uniqueOrderIds.slice(i, i + keyBatchSize);
      const existing = await db.select({ id: orderPnl.orderId })
        .from(orderPnl)
        .where(inArray(orderPnl.orderId, keyBatch));
      for (const e of existing) existingIds.add(e.id);
    }

    let inserted = 0;
    let updated = 0;
    for (const id of uniqueOrderIds) {
      if (existingIds.has(id)) updated++;
      else inserted++;
    }

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(orderPnl).values(batch)
        .onConflictDoUpdate({
          target: [orderPnl.orderId],
          set: {
            orderDate: sql`excluded.order_date`,
            shipDate: sql`excluded.ship_date`,
            channelRaw: sql`excluded.channel_raw`,
            company: sql`excluded.company`,
            channel: sql`excluded.channel`,
            qty: sql`excluded.qty`,
            subtotal: sql`excluded.subtotal`,
            grandTotal: sql`excluded.grand_total`,
            itemsCost: sql`excluded.items_cost`,
            shippingCost: sql`excluded.shipping_cost`,
            commission: sql`excluded.commission`,
            transactionFee: sql`excluded.transaction_fee`,
            postingFee: sql`excluded.posting_fee`,
            totalFees: sql`excluded.total_fees`,
            accrualProfit: sql`excluded.accrual_profit`,
            cashProfit: sql`excluded.cash_profit`,
            accrualMargin: sql`excluded.accrual_margin`,
          },
        });
    }

    return { inserted, updated, unchanged: 0 };
  }

  async upsertInventory(rows: InsertInventory[]): Promise<UpsertResult> {
    if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };
    await db.delete(inventoryCurrent);
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(inventoryCurrent).values(batch);
      inserted += batch.length;
    }
    return { inserted, updated: 0, unchanged: 0 };
  }

  async upsertChannelSales(rows: InsertChannelSale[]): Promise<UpsertResult> {
    if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };

    const uniqueKeys = Array.from(new Set(rows.map(r => `${r.reportDate}|${r.sku}`)));
    const existingKeys = new Set<string>();
    const keyBatchSize = 500;
    for (let i = 0; i < uniqueKeys.length; i += keyBatchSize) {
      const keyBatch = uniqueKeys.slice(i, i + keyBatchSize);
      const conditions = keyBatch.map(k => {
        const [d, s] = [k.substring(0, 10), k.substring(11)];
        return sql`(${channelSales.reportDate} = ${d} AND ${channelSales.sku} = ${s})`;
      });
      const existing = await db.select({ d: channelSales.reportDate, s: channelSales.sku })
        .from(channelSales)
        .where(sql.join(conditions, sql` OR `));
      for (const e of existing) existingKeys.add(`${e.d}|${e.s}`);
    }

    let inserted = 0;
    let updated = 0;
    for (const k of uniqueKeys) {
      if (existingKeys.has(k)) updated++;
      else inserted++;
    }

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await db.insert(channelSales).values(batch)
        .onConflictDoUpdate({
          target: [channelSales.reportDate, channelSales.sku],
          set: {
            productName: sql`excluded.product_name`,
            totalUnits: sql`excluded.total_units`,
            totalOrders: sql`excluded.total_orders`,
            totalSales: sql`excluded.total_sales`,
            channelData: sql`excluded.channel_data`,
          },
        });
    }

    return { inserted, updated, unchanged: 0 };
  }

  async clearTable(table: "daily_sales" | "order_pnl" | "inventory_current" | "channel_sales"): Promise<void> {
    const tableMap = { daily_sales: dailySales, order_pnl: orderPnl, inventory_current: inventoryCurrent, channel_sales: channelSales };
    await db.delete(tableMap[table]);
  }

  async getTableCounts(): Promise<Record<string, number>> {
    const [ds] = await db.select({ count: sql<number>`count(*)` }).from(dailySales);
    const [op] = await db.select({ count: sql<number>`count(*)` }).from(orderPnl);
    const [ic] = await db.select({ count: sql<number>`count(*)` }).from(inventoryCurrent);
    const [cs] = await db.select({ count: sql<number>`count(*)` }).from(channelSales);
    return {
      daily_sales: Number(ds.count),
      order_pnl: Number(op.count),
      inventory_current: Number(ic.count),
      channel_sales: Number(cs.count),
    };
  }
}

export const storage = new DatabaseStorage();
