import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import {
  detectReportType, parseDailySalesXlsx, parseOrderPnlXlsx,
  parseInventoryXlsx, parseChannelSalesXlsx,
} from "./parsers";
import {
  getDailyPulseData, getPnlData, getSkuTemperatureData,
  getReorderQueueData, getRepriceQueueData, getInventoryData,
  globalSearch, getProductDetail, refreshProductNames,
} from "./queries";
import { fetchEmailReports } from "./emailPipeline";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.originalname;
      const reportType = detectReportType(filename);

      if (reportType === "unknown") {
        return res.status(400).json({ error: `Cannot detect report type from filename: ${filename}` });
      }

      let result: any = {};

      switch (reportType) {
        case "daily_sales": {
          const { rows, dateRange } = parseDailySalesXlsx(req.file.buffer);
          const counts = await storage.upsertDailySales(rows);
          result = { type: "daily_sales", ...counts, totalParsed: rows.length, dateRange };
          break;
        }
        case "order_pnl": {
          const { rows, dateRange } = parseOrderPnlXlsx(req.file.buffer);
          const counts = await storage.upsertOrderPnl(rows);
          result = { type: "order_pnl", ...counts, totalParsed: rows.length, dateRange };
          break;
        }
        case "inventory": {
          const { rows } = parseInventoryXlsx(req.file.buffer);
          const counts = await storage.upsertInventory(rows);
          result = { type: "inventory", ...counts, totalParsed: rows.length };
          break;
        }
        case "channel_sales": {
          const { rows } = parseChannelSalesXlsx(req.file.buffer);
          const counts = await storage.upsertChannelSales(rows);
          result = { type: "channel_sales", ...counts, totalParsed: rows.length };
          break;
        }
      }

      refreshProductNames().catch(e => console.error("Product names refresh error:", e));
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  app.get("/api/data-status", async (req, res) => {
    try {
      const counts = await storage.getTableCounts();
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clear-table", async (req, res) => {
    try {
      const { table } = req.body;
      if (!["daily_sales", "order_pnl", "inventory_current", "channel_sales"].includes(table)) {
        return res.status(400).json({ error: "Invalid table name" });
      }
      await storage.clearTable(table);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/daily-pulse", async (req, res) => {
    try {
      const data = await getDailyPulseData();
      res.json(data);
    } catch (err: any) {
      console.error("Daily Pulse error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/pnl", async (req, res) => {
    try {
      const data = await getPnlData();
      res.json(data);
    } catch (err: any) {
      console.error("P&L error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/sku-temperature", async (req, res) => {
    try {
      const { category, search } = req.query;
      const data = await getSkuTemperatureData(
        category as string | undefined,
        search as string | undefined,
      );
      res.json(data);
    } catch (err: any) {
      console.error("SKU Temp error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/reorder-queue", async (req, res) => {
    try {
      const targetMargin = parseFloat(req.query.targetMargin as string) || 20;
      const data = await getReorderQueueData(targetMargin);
      res.json(data);
    } catch (err: any) {
      console.error("Reorder Queue error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/reprice-queue", async (req, res) => {
    try {
      const data = await getRepriceQueueData();
      res.json(data);
    } catch (err: any) {
      console.error("Reprice error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/inventory", async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== "false";
      const category = req.query.category as string | undefined;
      const search = req.query.search as string | undefined;
      const data = await getInventoryData(activeOnly, category, search);
      res.json(data);
    } catch (err: any) {
      console.error("Inventory error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fetch-email", async (req, res) => {
    try {
      const result = await fetchEmailReports();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Email fetch error:", err);
      res.status(500).json({ error: err.message || "Email fetch failed" });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q || q.trim().length < 2) {
        return res.json([]);
      }
      const results = await globalSearch(q);
      res.json(results);
    } catch (err: any) {
      console.error("Search error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/product/:sku", async (req, res) => {
    try {
      const data = await getProductDetail(req.params.sku);
      res.json(data);
    } catch (err: any) {
      console.error("Product detail error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/refresh-product-names", async (req, res) => {
    try {
      const count = await refreshProductNames();
      res.json({ success: true, count });
    } catch (err: any) {
      console.error("Refresh product names error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dashboard/daily-pulse/channel-breakdown", async (req, res) => {
    try {
      const data = await getPnlData();
      res.json(data.channelPnl);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
