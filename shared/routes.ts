import { z } from 'zod';
import { insertInventorySchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  dashboard: {
    dailyPulse: {
      method: 'GET' as const,
      path: '/api/dashboard/daily-pulse' as const,
      responses: {
        200: z.object({
          kpis: z.object({
            revenue: z.number(),
            profit: z.number(),
            margin: z.number(),
            orders: z.number(),
            units: z.number(),
          }),
          sparkline: z.array(z.object({ date: z.string(), value: z.number() })),
          comparisons: z.array(z.object({
            metric: z.string(),
            priorDay: z.number(),
            sameDayLastWeek: z.number(),
            mtdVsPriorMonth: z.number(),
            mtdVsSmly: z.number(),
            ytdVsPriorYtd: z.number(),
          }))
        }),
      }
    },
    reorderQueue: {
      method: 'GET' as const,
      path: '/api/dashboard/reorder-queue' as const,
      responses: {
        200: z.object({
          stats: z.object({
            critical: z.number(),
            urgent: z.number(),
            low: z.number(),
            totalReorderQty: z.number(),
            estPurchaseCost: z.number(),
          }),
          families: z.array(z.any()), 
        })
      }
    },
    skuTemperature: {
      method: 'GET' as const,
      path: '/api/dashboard/sku-temperature' as const,
      responses: {
        200: z.object({
          stats: z.object({
            hot: z.number(),
            rising: z.number(),
            falling: z.number(),
            dead: z.number(),
            totalSkus: z.number()
          }),
          items: z.array(z.any()), 
        })
      }
    },
    repriceQueue: {
      method: 'GET' as const,
      path: '/api/dashboard/reprice-queue' as const,
      responses: {
        200: z.object({
          stats: z.object({
            deadSkus: z.number(),
            deadCapital: z.number(),
            slowMovers: z.number(),
            slowCapital: z.number(),
            totalAtRisk: z.number()
          }),
          items: z.array(z.any())
        })
      }
    },
    pnl: {
      method: 'GET' as const,
      path: '/api/dashboard/pnl' as const,
      responses: {
        200: z.object({
          kpis: z.object({
            revenue: z.number(),
            profit: z.number(),
            margin: z.number(),
            totalFees: z.number(),
            orders: z.number(),
          }),
          channelPnl: z.array(z.any()),
          revenueTrend: z.array(z.object({ month: z.string(), revenue: z.number(), margin: z.number() })),
          dailyBreakdown: z.array(z.any()),
        })
      }
    }
  },
  inventory: {
    list: {
      method: 'GET' as const,
      path: '/api/inventory' as const,
      responses: {
        200: z.object({
          stats: z.object({
            dead: z.number(),
            critical: z.number(),
            low: z.number(),
            healthy: z.number(),
            overstocked: z.number()
          }),
          families: z.array(z.any())
        })
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}