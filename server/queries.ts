import { db } from "./db";
import { dailySales, orderPnl, inventoryCurrent, productNames } from "@shared/schema";
import { sql, eq, and, gte, lte, desc, asc, ilike, or } from "drizzle-orm";

async function loadDisplayNames(): Promise<Map<string, string>> {
  const rows = await db.select({ sku: productNames.sku, displayName: productNames.displayName }).from(productNames);
  return new Map(rows.map(r => [r.sku, r.displayName]));
}

export async function getDailyPulseData() {
  const today = new Date();
  const dayNum = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const priorMonthDate = new Date(year, month - 1, 1);
  const priorMonthStart = `${priorMonthDate.getFullYear()}-${String(priorMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const priorMonthEndDate = new Date(priorMonthDate.getFullYear(), priorMonthDate.getMonth() + 1, 0);
  const priorMonthDay = Math.min(dayNum, priorMonthEndDate.getDate());
  const priorMonthSameDay = `${priorMonthDate.getFullYear()}-${String(priorMonthDate.getMonth() + 1).padStart(2, "0")}-${String(priorMonthDay).padStart(2, "0")}`;

  const smlyYear = year - 1;
  const smlyMonth = month;
  const smlyStart = `${smlyYear}-${String(smlyMonth + 1).padStart(2, "0")}-01`;
  const smlyEndDate = new Date(smlyYear, smlyMonth + 1, 0);
  const smlyDay = Math.min(dayNum, smlyEndDate.getDate());
  const smlySameDay = `${smlyYear}-${String(smlyMonth + 1).padStart(2, "0")}-${String(smlyDay).padStart(2, "0")}`;

  const ytdStart = `${year}-01-01`;
  const priorYtdStart = `${year - 1}-01-01`;
  const priorYtdEnd = `${year - 1}-${String(month + 1).padStart(2, "0")}-${String(Math.min(dayNum, new Date(year - 1, month + 1, 0).getDate())).padStart(2, "0")}`;

  const [mtdPnl] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    fees: sql<number>`coalesce(sum(cast(total_fees as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
    units: sql<number>`coalesce(sum(qty), 0)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, monthStart), lte(orderPnl.shipDate, todayStr)));

  const revenue = Number(mtdPnl.revenue);
  const profit = Number(mtdPnl.profit);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const [priorMonthMtdPnl] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, priorMonthStart), lte(orderPnl.shipDate, priorMonthSameDay)));

  const [smlyMtdPnl] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, smlyStart), lte(orderPnl.shipDate, smlySameDay)));

  const [ytdPnl] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, ytdStart), lte(orderPnl.shipDate, todayStr)));

  const [priorYtdPnl] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, priorYtdStart), lte(orderPnl.shipDate, priorYtdEnd)));

  const dailyRevenue = await db.execute(sql`
    SELECT d::date::text AS date, COALESCE(SUM(CAST(o.grand_total AS numeric)), 0) AS revenue
    FROM generate_series(current_date - interval '13 days', current_date, '1 day') AS d
    LEFT JOIN order_pnl o ON CAST(o.ship_date AS date) = d::date
    GROUP BY d::date
    ORDER BY d::date ASC
  `);

  const monthlyRevenue = await db.select({
    month: sql<string>`to_char(cast(ship_date as date), 'YYYY-MM')`,
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
  }).from(orderPnl)
    .where(gte(orderPnl.shipDate, sql`current_date - interval '14 months'`))
    .groupBy(sql`to_char(cast(ship_date as date), 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(cast(ship_date as date), 'YYYY-MM')`));

  function pctChange(current: number, prior: number): number {
    if (prior === 0) return current > 0 ? 100 : 0;
    return ((current - prior) / Math.abs(prior)) * 100;
  }

  return {
    kpis: {
      revenue, profit, margin: Math.round(margin * 10) / 10,
      orders: Number(mtdPnl.orders), units: Number(mtdPnl.units),
      fees: Number(mtdPnl.fees),
    },
    dailyRevenue: (dailyRevenue.rows as any[]).map(r => ({ date: r.date, revenue: Number(r.revenue) })),
    monthlyRevenue: monthlyRevenue.map(r => ({
      month: r.month, revenue: Number(r.revenue),
      margin: Number(r.revenue) > 0 ? (Number(r.profit) / Number(r.revenue)) * 100 : 0
    })),
    comparisons: [
      {
        metric: "Revenue",
        mtd: revenue,
        priorMonthMtd: Number(priorMonthMtdPnl.revenue),
        priorMonthDelta: pctChange(revenue, Number(priorMonthMtdPnl.revenue)),
        smlyMtd: Number(smlyMtdPnl.revenue),
        smlyDelta: pctChange(revenue, Number(smlyMtdPnl.revenue)),
        ytd: Number(ytdPnl.revenue),
        priorYtd: Number(priorYtdPnl.revenue),
        ytdDelta: pctChange(Number(ytdPnl.revenue), Number(priorYtdPnl.revenue)),
      },
      {
        metric: "Profit",
        mtd: profit,
        priorMonthMtd: Number(priorMonthMtdPnl.profit),
        priorMonthDelta: pctChange(profit, Number(priorMonthMtdPnl.profit)),
        smlyMtd: Number(smlyMtdPnl.profit),
        smlyDelta: pctChange(profit, Number(smlyMtdPnl.profit)),
        ytd: Number(ytdPnl.profit),
        priorYtd: Number(priorYtdPnl.profit),
        ytdDelta: pctChange(Number(ytdPnl.profit), Number(priorYtdPnl.profit)),
      },
      {
        metric: "Orders",
        mtd: Number(mtdPnl.orders),
        priorMonthMtd: Number(priorMonthMtdPnl.orders),
        priorMonthDelta: pctChange(Number(mtdPnl.orders), Number(priorMonthMtdPnl.orders)),
        smlyMtd: Number(smlyMtdPnl.orders),
        smlyDelta: pctChange(Number(mtdPnl.orders), Number(smlyMtdPnl.orders)),
        ytd: Number(ytdPnl.orders),
        priorYtd: Number(priorYtdPnl.orders),
        ytdDelta: pctChange(Number(ytdPnl.orders), Number(priorYtdPnl.orders)),
      },
    ]
  };
}

export async function getPnlData() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const [mtdTotals] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    fees: sql<number>`coalesce(sum(cast(total_fees as numeric)), 0)`,
    cost: sql<number>`coalesce(sum(cast(items_cost as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
  }).from(orderPnl).where(and(gte(orderPnl.shipDate, monthStart), lte(orderPnl.shipDate, todayStr)));

  const revenue = Number(mtdTotals.revenue);
  const profit = Number(mtdTotals.profit);
  const fees = Number(mtdTotals.fees);

  const channelBreakdown = await db.select({
    channel: orderPnl.channel,
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
    fees: sql<number>`coalesce(sum(cast(total_fees as numeric)), 0)`,
    cost: sql<number>`coalesce(sum(cast(items_cost as numeric)), 0)`,
    orders: sql<number>`count(distinct order_id)`,
    units: sql<number>`coalesce(sum(qty), 0)`,
  }).from(orderPnl)
    .where(and(gte(orderPnl.shipDate, monthStart), lte(orderPnl.shipDate, todayStr)))
    .groupBy(orderPnl.channel)
    .orderBy(desc(sql`coalesce(sum(cast(grand_total as numeric)), 0)`));

  const channelPnl = channelBreakdown.map(c => {
    const rev = Number(c.revenue);
    const prof = Number(c.profit);
    const f = Number(c.fees);
    const ord = Number(c.orders);
    return {
      channel: c.channel,
      revenue: rev,
      pctOfTotal: revenue > 0 ? (rev / revenue) * 100 : 0,
      profit: prof,
      margin: rev > 0 ? (prof / rev) * 100 : 0,
      fees: f,
      feeRate: rev > 0 ? (f / rev) * 100 : 0,
      orders: ord,
      aov: ord > 0 ? rev / ord : 0,
      cost: Number(c.cost),
      units: Number(c.units),
      profitPerOrder: ord > 0 ? prof / ord : 0,
    };
  });

  const monthlyRevenue = await db.select({
    month: sql<string>`to_char(cast(ship_date as date), 'YYYY-MM')`,
    revenue: sql<number>`coalesce(sum(cast(grand_total as numeric)), 0)`,
    profit: sql<number>`coalesce(sum(cast(accrual_profit as numeric)), 0)`,
  }).from(orderPnl)
    .where(gte(orderPnl.shipDate, sql`current_date - interval '14 months'`))
    .groupBy(sql`to_char(cast(ship_date as date), 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(cast(ship_date as date), 'YYYY-MM')`));

  const dailyBreakdown = await db.execute(sql`
    SELECT d::date::text AS date,
      COALESCE(SUM(CAST(o.grand_total AS numeric)), 0) AS revenue,
      COALESCE(SUM(CAST(o.accrual_profit AS numeric)), 0) AS profit,
      COALESCE(SUM(CAST(o.total_fees AS numeric)), 0) AS fees,
      COUNT(DISTINCT o.order_id) AS orders,
      COALESCE(SUM(o.qty), 0) AS units
    FROM generate_series(${monthStart}::date, ${todayStr}::date, '1 day') AS d
    LEFT JOIN order_pnl o ON CAST(o.ship_date AS date) = d::date
    GROUP BY d::date
    ORDER BY d::date DESC
  `);

  return {
    kpis: {
      revenue, profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      totalFees: fees,
      feeRate: revenue > 0 ? Math.round((fees / revenue) * 1000) / 10 : 0,
      orders: Number(mtdTotals.orders),
    },
    channelPnl,
    revenueTrend: monthlyRevenue.map(r => ({
      month: r.month,
      revenue: Number(r.revenue),
      margin: Number(r.revenue) > 0 ? (Number(r.profit) / Number(r.revenue)) * 100 : 0,
    })),
    dailyBreakdown: (dailyBreakdown.rows as any[]).map(d => ({
      date: d.date,
      revenue: Number(d.revenue),
      profit: Number(d.profit),
      margin: Number(d.revenue) > 0 ? (Number(d.profit) / Number(d.revenue)) * 100 : 0,
      fees: Number(d.fees),
      orders: Number(d.orders),
      units: Number(d.units),
    })),
  };
}

export async function getSkuTemperatureData(category?: string, search?: string) {
  const today = new Date();
  const dayNum = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(year, month, 0);
  const lastMonthEndStr = lastMonthEnd.toISOString().substring(0, 10);

  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().substring(0, 10);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString().substring(0, 10);

  const mtdSales = await db.select({
    sku: dailySales.sku,
    productName: sql<string>`max(product_name)`,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, monthStart), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const lastMonthSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, lastMonthStart), lte(dailySales.shipDate, lastMonthEndStr)))
    .groupBy(dailySales.sku);

  const thisWeekSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, weekAgo), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const lastWeekSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, twoWeeksAgo), lte(dailySales.shipDate, weekAgo)))
    .groupBy(dailySales.sku);

  const lmMap = new Map(lastMonthSales.map(r => [r.sku, { qty: Number(r.qtySold), rev: Number(r.revenue) }]));
  const twMap = new Map(thisWeekSales.map(r => [r.sku, Number(r.qtySold)]));
  const lwMap = new Map(lastWeekSales.map(r => [r.sku, Number(r.qtySold)]));

  const { parseSku } = await import("./sku");
  const nameMap = await loadDisplayNames();

  const daysInLastMonth = lastMonthEnd.getDate();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = dayNum;

  const allSkus = new Set([...mtdSales.map(r => r.sku), ...lastMonthSales.map(r => r.sku)]);
  const items: any[] = [];

  for (const sku of allSkus) {
    const mtd = mtdSales.find(r => r.sku === sku);
    const lm = lmMap.get(sku);
    const mtdQty = mtd ? Number(mtd.qtySold) : 0;
    const lmQty = lm ? lm.qty : 0;

    if (mtdQty === 0 && lmQty === 0) continue;

    const parsed = parseSku(sku);
    if (category && category !== "All" && parsed.category !== category) continue;
    const displayName = nameMap.get(sku) || mtd?.productName || sku;
    if (search && !displayName.toLowerCase().includes(search.toLowerCase()) && !sku.toLowerCase().includes(search.toLowerCase())) continue;

    const mtdRate = daysElapsed > 0 ? mtdQty / daysElapsed : 0;
    const lmRate = daysInLastMonth > 0 ? lmQty / daysInLastMonth : 0;
    const pacePct = lmRate > 0 ? (mtdRate / lmRate) * 100 : (mtdQty > 0 ? 999 : 0);

    let trend = "STABLE";
    if (mtdQty === 0 && lmQty > 0) {
      trend = "DEAD";
    } else if (lmRate > 0) {
      if (pacePct > 150 && mtdQty > 10) {
        trend = "HOT";
      } else if (pacePct > 150) {
        trend = "RISING";
      } else if (pacePct < 50) {
        trend = "FALLING";
      } else {
        trend = "STABLE";
      }
    }

    const mtdVsLm = lmQty > 0 ? (pacePct - 100) : (mtdQty > 0 ? 100 : 0);

    items.push({
      sku,
      product: displayName,
      category: parsed.category,
      trend,
      thisWeek: twMap.get(sku) || 0,
      lastWeek: lwMap.get(sku) || 0,
      soldMtd: mtdQty,
      mtdRevenue: mtd ? Number(mtd.revenue) : 0,
      soldLm: lmQty,
      lmRevenue: lm ? lm.rev : 0,
      mtdVsLm: Math.round(mtdVsLm * 10) / 10,
    });
  }

  const stats = {
    hot: items.filter(i => i.trend === "HOT").length,
    rising: items.filter(i => i.trend === "RISING").length,
    falling: items.filter(i => i.trend === "FALLING").length,
    dead: items.filter(i => i.trend === "DEAD").length,
    totalSkus: items.length,
  };

  items.sort((a, b) => {
    const order: Record<string, number> = { HOT: 0, RISING: 1, FALLING: 2, DEAD: 3, STABLE: 4 };
    return (order[a.trend] ?? 5) - (order[b.trend] ?? 5) || b.soldMtd - a.soldMtd;
  });

  return { stats, items };
}

export async function getReorderQueueData(targetMargin: number = 20) {
  const today = new Date();
  const dayNum = today.getDate() || 1;
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(year, month, 0).toISOString().substring(0, 10);

  const smlyStart = `${year - 1}-${String(month + 1).padStart(2, "0")}-01`;
  const smlyEnd = `${year - 1}-${String(month + 1).padStart(2, "0")}-${String(Math.min(dayNum, 28)).padStart(2, "0")}`;

  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().substring(0, 10);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString().substring(0, 10);

  const inventory = await db.select().from(inventoryCurrent);

  const mtdSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, monthStart), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const lastMonthSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, lastMonthStart), lte(dailySales.shipDate, lastMonthEnd)))
    .groupBy(dailySales.sku);

  const thisWeekSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, weekAgo), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const lastWeekSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, twoWeeksAgo), lte(dailySales.shipDate, weekAgo)))
    .groupBy(dailySales.sku);

  const smlySales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, smlyStart), lte(dailySales.shipDate, smlyEnd)))
    .groupBy(dailySales.sku);

  const mtdMap = new Map(mtdSales.map(r => [r.sku, { qty: Number(r.qtySold), rev: Number(r.revenue) }]));
  const lmMap = new Map(lastMonthSales.map(r => [r.sku, Number(r.qtySold)]));
  const twMap = new Map(thisWeekSales.map(r => [r.sku, Number(r.qtySold)]));
  const lwMap = new Map(lastWeekSales.map(r => [r.sku, Number(r.qtySold)]));
  const smlyMap = new Map(smlySales.map(r => [r.sku, Number(r.qtySold)]));

  const { parseSku } = await import("./sku");
  const nameMap = await loadDisplayNames();

  const familyMap = new Map<string, any>();

  for (const inv of inventory) {
    if (inv.bucket === "failed" || inv.bucket === "intake") continue;

    const parsed = parseSku(inv.sku);
    const mtd = mtdMap.get(inv.sku);
    const mtdQty = mtd ? mtd.qty : 0;
    const velocity = dayNum > 0 ? mtdQty / dayNum : 0;

    if (velocity <= 0) continue;

    const available = Math.max(0, inv.available);
    let daysLeft = velocity > 0 ? available / velocity : 999;
    if (daysLeft > 14) continue;

    let urgency = "OK";
    if (daysLeft <= 2) urgency = "CRITICAL";
    else if (daysLeft <= 5) urgency = "URGENT";
    else if (daysLeft <= 14) urgency = "LOW";

    const avgPrice = mtd && mtdQty > 0 ? mtd.rev / mtdQty : 0;
    const maxBuy = avgPrice * (1 - targetMargin / 100);
    const reorderQty = Math.max(0, Math.round((velocity * 30) - available));
    const soldLw = twMap.get(inv.sku) || 0;
    const soldPriorWeek = lwMap.get(inv.sku) || 0;
    const soldMtd = mtdQty;
    const lastMonth = lmMap.get(inv.sku) || 0;
    const smly = smlyMap.get(inv.sku) || 0;

    const skuData = {
      sku: inv.sku,
      product: nameMap.get(inv.sku) || inv.productName || inv.sku,
      grade: parsed.grade,
      urgency,
      onHand: available,
      rawOnHand: inv.available,
      daysLeft: Math.round(daysLeft * 10) / 10,
      velocity: Math.round(velocity * 100) / 100,
      soldLw,
      soldLwDelta: soldPriorWeek > 0 ? Math.round(((soldLw - soldPriorWeek) / soldPriorWeek) * 100) : 0,
      soldMtd,
      lastMonth,
      smly,
      smlyDelta: smly > 0 ? Math.round(((soldMtd - smly) / smly) * 100) : 0,
      avgCost: Number(inv.cost),
      maxBuy: Math.round(maxBuy * 100) / 100,
      reorderQty,
      category: parsed.category,
    };

    const family = parsed.productFamily;
    if (!familyMap.has(family)) {
      familyMap.set(family, {
        productFamily: family,
        product: nameMap.get(inv.sku) || inv.productName || family,
        urgency,
        onHand: 0,
        daysLeft: 999,
        velocity: 0,
        soldLw: 0,
        soldMtd: 0,
        lastMonth: 0,
        smly: 0,
        avgCost: 0,
        maxBuy: 0,
        reorderQty: 0,
        skus: [],
      });
    }

    const fam = familyMap.get(family)!;
    fam.skus.push(skuData);
    fam.onHand += skuData.onHand;
    fam.velocity += skuData.velocity;
    fam.soldLw += skuData.soldLw;
    fam.soldMtd += skuData.soldMtd;
    fam.lastMonth += skuData.lastMonth;
    fam.smly += skuData.smly;
    fam.reorderQty += skuData.reorderQty;
    if (skuData.daysLeft < fam.daysLeft) {
      fam.daysLeft = skuData.daysLeft;
      fam.urgency = skuData.urgency;
    }
  }

  const families = Array.from(familyMap.values());

  for (const fam of families) {
    if (fam.skus.length > 0) {
      const bestSku = fam.skus.reduce((a: any, b: any) => b.soldMtd > a.soldMtd ? b : a, fam.skus[0]);
      fam.product = bestSku.product;
    }
    if (fam.onHand > 0) {
      const totalCost = fam.skus.reduce((s: number, sk: any) => s + (sk.avgCost * Math.max(0, sk.onHand)), 0);
      fam.avgCost = Math.round((totalCost / fam.onHand) * 100) / 100;
    } else {
      const skuWithCost = fam.skus.find((sk: any) => sk.avgCost > 0);
      if (skuWithCost) fam.avgCost = skuWithCost.avgCost;
    }
    const totalRev = fam.skus.reduce((s: number, sk: any) => s + (mtdMap.get(sk.sku)?.rev || 0), 0);
    const totalSold = fam.skus.reduce((s: number, sk: any) => s + sk.soldMtd, 0);
    const avgSellPrice = totalSold > 0 ? totalRev / totalSold : 0;
    fam.maxBuy = Math.round(avgSellPrice * (1 - targetMargin / 100) * 100) / 100;
  }

  families.sort((a, b) => a.daysLeft - b.daysLeft);

  const stats = {
    critical: families.filter(f => f.urgency === "CRITICAL").length,
    urgent: families.filter(f => f.urgency === "URGENT").length,
    low: families.filter(f => f.urgency === "LOW").length,
    totalReorderQty: families.reduce((s, f) => s + f.reorderQty, 0),
    estPurchaseCost: Math.round(families.reduce((s, f) => s + f.reorderQty * f.avgCost, 0)),
  };

  return { stats, families };
}

export async function getRepriceQueueData() {
  const today = new Date();
  const dayNum = today.getDate() || 1;
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(year, month, 0).toISOString().substring(0, 10);

  const inventory = await db.select().from(inventoryCurrent);

  const mtdSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, monthStart), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const lmSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, lastMonthStart), lte(dailySales.shipDate, lastMonthEnd)))
    .groupBy(dailySales.sku);

  const mtdMap = new Map(mtdSales.map(r => [r.sku, { qty: Number(r.qtySold), rev: Number(r.revenue) }]));
  const lmMap = new Map(lmSales.map(r => [r.sku, { qty: Number(r.qtySold), rev: Number(r.revenue) }]));

  const items: any[] = [];
  let deadSkus = 0, deadCapital = 0, slowMovers = 0, slowCapital = 0;

  const { parseSku } = await import("./sku");
  const nameMap = await loadDisplayNames();

  for (const inv of inventory) {
    if (inv.bucket === "failed" || inv.bucket === "intake") continue;
    const parsed = parseSku(inv.sku);
    if (parsed.grade === "XF" || parsed.grade === "XC") continue;
    if (inv.available <= 0) continue;

    const mtd = mtdMap.get(inv.sku);
    const lm = lmMap.get(inv.sku);
    const mtdQty = mtd ? mtd.qty : 0;
    const lmQty = lm ? lm.qty : 0;
    const cost = Number(inv.cost) || 0;
    const validCapital = cost > 0 ? inv.available * cost : 0;

    const lmDaily = lmQty / 30;
    const expectedMtd = lmDaily * dayNum;
    const pace = expectedMtd > 0 ? (mtdQty / expectedMtd) * 100 : (mtdQty > 0 ? 100 : 0);

    let status = "";
    if (mtdQty === 0 && lmQty > 0) {
      status = "DEAD";
      deadSkus++;
      deadCapital += validCapital;
    } else if (mtdQty === 0 && lmQty === 0 && inv.available > 0) {
      status = "DEAD";
      deadSkus++;
      deadCapital += validCapital;
    } else if (pace < 30 && lmQty > 0) {
      status = "SLOW";
      slowMovers++;
      slowCapital += validCapital;
    } else {
      continue;
    }

    let avgPrice: number | null = null;
    if (mtd && mtdQty > 0) {
      avgPrice = mtd.rev / mtdQty;
    } else if (lm && lmQty > 0) {
      avgPrice = lm.rev / lmQty;
    } else {
      const sp = Number(inv.sitePrice) || 0;
      const lp = Number(inv.listPrice) || 0;
      avgPrice = sp > 0 ? sp : (lp > 0 ? lp : null);
    }
    const feeRate = 0.15;
    const breakEven = cost > 0 ? cost / (1 - feeRate) : 0;
    const wholesaleFloor = cost > 0 ? cost * 1.05 : 0;

    items.push({
      sku: inv.sku,
      product: nameMap.get(inv.sku) || inv.productName || inv.sku,
      category: parsed.category || inv.category || "Other",
      status,
      qty: inv.available,
      avgPrice: avgPrice !== null ? Math.round(avgPrice * 100) / 100 : null,
      cost,
      pace: Math.round(pace),
      soldMtd: mtdQty,
      soldLm: lmQty,
      capital: Math.round(validCapital),
      breakEven: Math.round(breakEven * 100) / 100,
      wholesaleFloor: Math.round(wholesaleFloor * 100) / 100,
      currentMargin: avgPrice && avgPrice > 0 ? Math.round(((avgPrice - cost - avgPrice * feeRate) / avgPrice) * 10000) / 100 : 0,
    });
  }

  items.sort((a, b) => b.capital - a.capital);

  return {
    stats: {
      deadSkus,
      deadCapital: Math.round(deadCapital),
      slowMovers,
      slowCapital: Math.round(slowCapital),
      totalAtRisk: Math.round(deadCapital + slowCapital),
    },
    items,
  };
}

export async function refreshProductNames() {
  const SKU_NAME_MAP: Record<string, string> = {
    IPH: "iPhone", IP: "iPhone", IPD: "iPad", IPDM: "iPad Mini", IPDP: "iPad Pro",
    IPDA: "iPad Air", MBP: "MacBook Pro", MBA: "MacBook Air", MACM: "Mac Mini",
    GS: "Galaxy S", GN: "Galaxy Note", GP: "Galaxy", APMC: "Apple Watch", AW: "Apple Watch",
  };
  const MANUFACTURER_MAP: Record<string, string> = {
    APPLE: "Apple", SAMSUNG: "Samsung", GOOGLE: "Google", MOTOROLA: "Motorola", LG: "LG",
  };
  const CARRIER_MAP: Record<string, string> = {
    UN: "Unlocked", VZ: "Verizon", AT: "AT&T", TM: "T-Mobile", SP: "Sprint", WI: "WiFi", HSO: "",
  };
  const STORAGE_MAP: Record<string, string> = {
    "64": "64GB", "128": "128GB", "256": "256GB", "512": "512GB", "1T": "1TB",
  };
  const COLOR_MAP: Record<string, string> = {
    BLU: "Blue", BLA: "Black", SIL: "Silver", GLD: "Gold", SPG: "Space Gray",
    PUR: "Purple", GRN: "Green", RED: "Red", WHT: "White", YEL: "Yellow",
    PIN: "Pink", ROG: "Rose Gold", GRA: "Graphite", MID: "Midnight", STA: "Starlight",
  };
  const GRADE_MAP: Record<string, string> = {
    CAP1: "Premium 100%", CAP: "Premium", "CA+": "Excellent", CA: "Good",
    CAB: "Good (Low Batt)", SD: "B-Grade", "SD-": "C-Grade", SDB: "B-Grade (Low Batt)",
  };

  function buildNameFromSku(sku: string): string {
    const parts = sku.split("-");
    const tokens: string[] = [];
    for (const p of parts) {
      const upper = p.toUpperCase();
      if (MANUFACTURER_MAP[upper]) { tokens.push(MANUFACTURER_MAP[upper]); continue; }
      let matched = false;
      for (const [code, name] of Object.entries(SKU_NAME_MAP)) {
        if (upper === code || upper.startsWith(code)) { tokens.push(name); matched = true; break; }
      }
      if (matched) continue;
      if (CARRIER_MAP[upper] !== undefined) { if (CARRIER_MAP[upper]) tokens.push(CARRIER_MAP[upper]); continue; }
      if (STORAGE_MAP[upper]) { tokens.push(STORAGE_MAP[upper]); continue; }
      if (COLOR_MAP[upper]) { tokens.push(COLOR_MAP[upper]); continue; }
      if (GRADE_MAP[upper]) { tokens.push(GRADE_MAP[upper]); continue; }
      if (upper === "INTAKE") continue;
      tokens.push(p);
    }
    return tokens.join(" ") || sku;
  }

  const invNames = await db.select({ sku: inventoryCurrent.sku, productName: inventoryCurrent.productName }).from(inventoryCurrent);
  const salesNames = await db.select({
    sku: dailySales.sku,
    productName: sql<string>`max(product_name)`,
  }).from(dailySales).groupBy(dailySales.sku);

  const invMap = new Map(invNames.filter(r => r.productName).map(r => [r.sku, r.productName!]));
  const salesMap = new Map(salesNames.filter(r => r.productName).map(r => [r.sku, r.productName!]));

  const allSkus = new Set([...invMap.keys(), ...salesMap.keys()]);

  await db.delete(productNames);

  const rows: { sku: string; displayName: string; nameSource: string }[] = [];
  for (const sku of allSkus) {
    let displayName: string;
    let nameSource: string;
    if (invMap.has(sku)) {
      displayName = invMap.get(sku)!;
      nameSource = "inventory";
    } else if (salesMap.has(sku)) {
      displayName = salesMap.get(sku)!;
      nameSource = "sales";
    } else {
      displayName = buildNameFromSku(sku);
      nameSource = "parsed";
    }
    rows.push({ sku, displayName, nameSource });
  }

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(productNames).values(rows.slice(i, i + batchSize));
  }

  return rows.length;
}

export async function globalSearch(query: string) {
  if (!query || query.trim().length < 2) return [];

  const searchTerm = `%${query.trim()}%`;

  const results = await db.execute(sql`
    WITH all_skus AS (
      SELECT DISTINCT sku FROM (
        SELECT sku FROM inventory_current
        UNION
        SELECT sku FROM daily_sales
      ) s
    ),
    inv AS (
      SELECT sku, product_name, category, available, cost, site_price, list_price, grade, bucket
      FROM inventory_current
    ),
    mtd_sales AS (
      SELECT sku, COALESCE(SUM(qty_sold), 0) as sold_mtd, COALESCE(SUM(CAST(subtotal AS numeric)), 0) as rev_mtd
      FROM daily_sales
      WHERE cast(ship_date as date) >= date_trunc('month', current_date)::date
        AND cast(ship_date as date) <= current_date
      GROUP BY sku
    ),
    lm_sales AS (
      SELECT sku, COALESCE(SUM(qty_sold), 0) as sold_lm
      FROM daily_sales
      WHERE cast(ship_date as date) >= (date_trunc('month', current_date) - interval '1 month')::date
        AND cast(ship_date as date) < date_trunc('month', current_date)::date
      GROUP BY sku
    ),
    names AS (
      SELECT sku, display_name FROM product_names
    )
    SELECT
      a.sku,
      COALESCE(n.display_name, i.product_name, a.sku) as display_name,
      i.category,
      COALESCE(i.available, 0) as available,
      COALESCE(i.cost, '0') as cost,
      i.grade,
      i.bucket,
      COALESCE(m.sold_mtd, 0) as sold_mtd,
      COALESCE(m.rev_mtd, 0) as rev_mtd,
      COALESCE(l.sold_lm, 0) as sold_lm,
      CASE WHEN i.sku IS NOT NULL THEN true ELSE false END as in_inventory
    FROM all_skus a
    LEFT JOIN inv i ON i.sku = a.sku
    LEFT JOIN mtd_sales m ON m.sku = a.sku
    LEFT JOIN lm_sales l ON l.sku = a.sku
    LEFT JOIN names n ON n.sku = a.sku
    WHERE (
      a.sku ILIKE ${searchTerm}
      OR COALESCE(n.display_name, i.product_name, '') ILIKE ${searchTerm}
    )
    ORDER BY COALESCE(m.sold_mtd, 0) DESC, COALESCE(i.available, 0) DESC
    LIMIT 25
  `);

  const { parseSku } = await import("./sku");

  return (results.rows as any[]).map(r => {
    const parsed = parseSku(r.sku);
    const mtdQty = Number(r.sold_mtd);
    const lmQty = Number(r.sold_lm);
    const available = Number(r.available);
    const dayNum = new Date().getDate() || 1;
    const velocity = dayNum > 0 ? mtdQty / dayNum : 0;
    const daysLeft = velocity > 0 ? available / velocity : 999;

    let health = "healthy";
    if (velocity === 0 && mtdQty === 0) health = "dead";
    else if (daysLeft <= 5) health = "critical";
    else if (daysLeft <= 14) health = "low";
    else if (daysLeft > 120) health = "overstocked";

    const lmDays = new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate();
    const mtdRate = dayNum > 0 ? mtdQty / dayNum : 0;
    const lmRate = lmDays > 0 ? lmQty / lmDays : 0;
    const pacePct = lmRate > 0 ? (mtdRate / lmRate) * 100 : (mtdQty > 0 ? 999 : 0);

    let temperature = "STABLE";
    if (mtdQty === 0 && lmQty > 0) temperature = "DEAD";
    else if (lmRate > 0) {
      if (pacePct > 150 && mtdQty > 10) temperature = "HOT";
      else if (pacePct > 150) temperature = "RISING";
      else if (pacePct < 50) temperature = "FALLING";
    }

    const inInventory = r.in_inventory === true || r.in_inventory === "t";
    const hasReorderSignal = velocity > 0 && daysLeft <= 14 && inInventory;
    const hasRepriceSignal = inInventory && available > 0 && (mtdQty === 0 || (lmQty > 0 && pacePct < 30));
    const hasTempSignal = mtdQty > 0 || lmQty > 0;

    const screens: string[] = [];
    if (hasReorderSignal) screens.push("Reorder");
    if (hasTempSignal) screens.push("Temperature");
    if (hasRepriceSignal) screens.push("Reprice");
    if (inInventory) screens.push("Inventory");

    return {
      sku: r.sku,
      displayName: r.display_name || r.sku,
      category: r.category || parsed.category,
      grade: parsed.grade,
      available,
      soldMtd: mtdQty,
      soldLm: lmQty,
      velocity: Math.round(velocity * 100) / 100,
      daysLeft: Math.round(daysLeft),
      health,
      temperature,
      cost: Number(r.cost),
      revMtd: Number(r.rev_mtd),
      screens,
      inInventory,
    };
  });
}

export async function getProductDetail(sku: string) {
  const today = new Date();
  const dayNum = today.getDate() || 1;
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const lmDate = new Date(year, month - 1, 1);
  const lmStartStr = `${lmDate.getFullYear()}-${String(lmDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEndDate = new Date(year, month, 0);
  const lmEndStr = `${lmEndDate.getFullYear()}-${String(lmEndDate.getMonth() + 1).padStart(2, "0")}-${String(lmEndDate.getDate()).padStart(2, "0")}`;

  const [inv] = await db.select().from(inventoryCurrent).where(eq(inventoryCurrent.sku, sku)).limit(1);

  const [mtd] = await db.select({
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales).where(and(eq(dailySales.sku, sku), gte(dailySales.shipDate, monthStart), lte(dailySales.shipDate, todayStr)));

  const [lm] = await db.select({
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales).where(and(eq(dailySales.sku, sku), gte(dailySales.shipDate, lmStartStr), lte(dailySales.shipDate, lmEndStr)));

  const recentOrders = await db.select({
    orderId: orderPnl.orderId,
    shipDate: orderPnl.shipDate,
    channel: orderPnl.channel,
    revenue: orderPnl.grandTotal,
    profit: orderPnl.accrualProfit,
    qty: orderPnl.qty,
  }).from(orderPnl)
    .where(sql`${orderPnl.orderId} LIKE '%' || ${sku} || '%'`)
    .orderBy(desc(orderPnl.shipDate))
    .limit(10);

  const dailyHistory = await db.select({
    date: dailySales.shipDate,
    qtySold: dailySales.qtySold,
    revenue: sql<number>`cast(subtotal as numeric)`,
  }).from(dailySales)
    .where(and(eq(dailySales.sku, sku), gte(dailySales.shipDate, sql`current_date - interval '30 days'`)))
    .orderBy(asc(dailySales.shipDate));

  const [nameRow] = await db.select().from(productNames).where(eq(productNames.sku, sku)).limit(1);

  const { parseSku } = await import("./sku");
  const parsed = parseSku(sku);
  const mtdQty = Number(mtd?.qtySold || 0);
  const lmQty = Number(lm?.qtySold || 0);
  const velocity = dayNum > 0 ? mtdQty / dayNum : 0;
  const available = inv ? Math.max(0, inv.available) : 0;
  const daysLeft = velocity > 0 ? available / velocity : 999;

  return {
    sku,
    displayName: nameRow?.displayName || inv?.productName || sku,
    category: inv?.category || parsed.category,
    grade: parsed.grade,
    bucket: inv?.bucket || parsed.bucket,
    available,
    physical: inv?.physical || 0,
    reserved: inv?.reserved || 0,
    cost: Number(inv?.cost || 0),
    listPrice: Number(inv?.listPrice || 0),
    sitePrice: Number(inv?.sitePrice || 0),
    value: Number(inv?.value || 0),
    velocity: Math.round(velocity * 100) / 100,
    daysLeft: Math.round(daysLeft),
    soldMtd: mtdQty,
    revMtd: Number(mtd?.revenue || 0),
    soldLm: lmQty,
    revLm: Number(lm?.revenue || 0),
    avgPrice: mtdQty > 0 ? Math.round(Number(mtd?.revenue || 0) / mtdQty * 100) / 100 : 0,
    dailyHistory: dailyHistory.map(d => ({ date: d.date, qty: Number(d.qtySold), revenue: Number(d.revenue) })),
    recentOrders: recentOrders.map(o => ({
      orderId: o.orderId,
      shipDate: o.shipDate,
      channel: o.channel,
      revenue: Number(o.revenue),
      profit: Number(o.profit),
      qty: Number(o.qty),
    })),
    inInventory: !!inv,
    warehouse: inv?.warehouse || null,
    lastReceived: inv?.lastReceived || null,
  };
}

export async function getInventoryData(activeOnly: boolean = true, category?: string, search?: string) {
  const today = new Date();
  const dayNum = today.getDate() || 1;
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().substring(0, 10);

  const inventory = await db.select().from(inventoryCurrent);

  const mtdSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
    revenue: sql<number>`coalesce(sum(cast(subtotal as numeric)), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, monthStart), lte(dailySales.shipDate, todayStr)))
    .groupBy(dailySales.sku);

  const mtdMap = new Map(mtdSales.map(r => [r.sku, { qty: Number(r.qtySold), rev: Number(r.revenue) }]));

  const lmDate = new Date(year, month - 1, 1);
  const lmStartStr = `${lmDate.getFullYear()}-${String(lmDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEndDate = new Date(year, month, 0);
  const lmEndStr = `${lmEndDate.getFullYear()}-${String(lmEndDate.getMonth() + 1).padStart(2, "0")}-${String(lmEndDate.getDate()).padStart(2, "0")}`;

  const lmSales = await db.select({
    sku: dailySales.sku,
    qtySold: sql<number>`coalesce(sum(qty_sold), 0)`,
  }).from(dailySales)
    .where(and(gte(dailySales.shipDate, lmStartStr), lte(dailySales.shipDate, lmEndStr)))
    .groupBy(dailySales.sku);

  const lmMap = new Map(lmSales.map(r => [r.sku, Number(r.qtySold)]));

  const { parseSku } = await import("./sku");
  const nameMap = await loadDisplayNames();

  const familyMap = new Map<string, any>();
  let dead = 0, critical = 0, low = 0, healthy = 0, overstocked = 0;

  for (const inv of inventory) {
    if (inv.bucket === "failed") continue;

    const parsed = parseSku(inv.sku);
    if (parsed.grade === "XF" || parsed.grade === "XC") continue;
    if (category && category !== "All" && parsed.category !== category) continue;
    const invDisplayName = nameMap.get(inv.sku) || inv.productName || inv.sku;
    if (search && !invDisplayName.toLowerCase().includes(search.toLowerCase()) && !inv.sku.toLowerCase().includes(search.toLowerCase())) continue;

    const mtd = mtdMap.get(inv.sku);
    const mtdQty = mtd ? mtd.qty : 0;
    const velocity = dayNum > 0 ? mtdQty / dayNum : 0;
    let daysLeft = velocity > 0 ? inv.available / velocity : 999;

    if (inv.available <= 0) {
      daysLeft = 0;
    }

    const lmQty = lmMap.get(inv.sku) || 0;
    if (activeOnly && velocity === 0 && mtdQty === 0 && lmQty === 0) continue;

    let health = "healthy";
    if (velocity === 0 && mtdQty === 0) { health = "dead"; dead++; }
    else if (daysLeft <= 5) { health = "critical"; critical++; }
    else if (daysLeft <= 14) { health = "low"; low++; }
    else if (daysLeft > 120) { health = "overstocked"; overstocked++; }
    else { healthy++; }

    const capital = inv.available * Number(inv.cost);

    const skuRow = {
      sku: inv.sku,
      product: invDisplayName,
      grade: parsed.grade,
      health,
      available: Math.max(0, inv.available),
      rawAvailable: inv.available,
      capital: Math.round(Math.max(0, capital)),
      velocity: Math.round(velocity * 100) / 100,
      daysLeft: Math.round(daysLeft),
      soldMtd: mtdQty,
      revMtd: mtd ? Math.round(mtd.rev) : 0,
      cost: Number(inv.cost),
      category: parsed.category,
    };

    const family = parsed.productFamily;
    if (!familyMap.has(family)) {
      familyMap.set(family, {
        productFamily: family,
        product: invDisplayName,
        health: "healthy",
        available: 0,
        capital: 0,
        velocity: 0,
        daysLeft: 999,
        soldMtd: 0,
        revMtd: 0,
        skus: [],
        category: parsed.category,
      });
    }

    const fam = familyMap.get(family)!;
    fam.skus.push(skuRow);
    fam.available += skuRow.available;
    fam.capital += skuRow.capital;
    fam.velocity += skuRow.velocity;
    fam.soldMtd += skuRow.soldMtd;
    fam.revMtd += skuRow.revMtd;
    if (skuRow.daysLeft < fam.daysLeft) {
      fam.daysLeft = skuRow.daysLeft;
    }

    const worstHealth = ["dead", "critical", "low", "healthy", "overstocked"];
    if (worstHealth.indexOf(skuRow.health) < worstHealth.indexOf(fam.health)) {
      fam.health = skuRow.health;
    }
  }

  const families = Array.from(familyMap.values());

  for (const fam of families) {
    if (fam.skus.length > 0) {
      const bestSku = fam.skus.reduce((a: any, b: any) => b.soldMtd > a.soldMtd ? b : a, fam.skus[0]);
      fam.product = bestSku.product;
    }
  }

  families.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    stats: { dead, critical, low, healthy, overstocked },
    families,
  };
}
