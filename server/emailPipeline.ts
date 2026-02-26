import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import { storage } from "./storage";
import {
  detectReportType,
  parseDailySalesXlsx,
  parseOrderPnlXlsx,
  parseInventoryXlsx,
  parseChannelSalesXlsx,
} from "./parsers";

interface ReportResult {
  filename: string;
  reportType: string;
  inserted: number;
  updated: number;
  unchanged: number;
  totalParsed: number;
  dateRange?: string;
  error?: string;
}

interface PipelineResult {
  emailsScanned: number;
  reportsImported: number;
  reports: ReportResult[];
  errors: string[];
}

function imapConnect(config: Imap.Config): Promise<Imap> {
  return new Promise((resolve, reject) => {
    const imap = new Imap(config);
    imap.once("ready", () => resolve(imap));
    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
}

function imapOpenBox(imap: Imap, box: string): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox(box, false, (err, mailbox) => {
      if (err) reject(err);
      else resolve(mailbox);
    });
  });
}

function imapSearch(imap: Imap, criteria: any[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) reject(err);
      else resolve(results || []);
    });
  });
}

function imapFetchOne(imap: Imap, uid: number): Promise<ParsedMail> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Timeout fetching email UID ${uid}`));
      }
    }, 60000);

    const f = imap.fetch([uid], { bodies: "", markSeen: true });
    f.on("message", (msg) => {
      let buffer = "";
      msg.on("body", (stream) => {
        stream.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
        });
        stream.on("end", () => {
          simpleParser(buffer)
            .then((parsed) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(parsed);
              }
            })
            .catch((err) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(err);
              }
            });
        });
      });
    });
    f.once("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
    f.once("end", () => {});
  });
}

async function importBuffer(
  buffer: Buffer,
  filename: string
): Promise<ReportResult> {
  const reportType = detectReportType(filename);

  if (reportType === "unknown") {
    return {
      filename,
      reportType: "unknown",
      inserted: 0,
      updated: 0,
      unchanged: 0,
      totalParsed: 0,
      error: `Cannot detect report type from filename: ${filename}`,
    };
  }

  switch (reportType) {
    case "daily_sales": {
      const { rows, dateRange } = parseDailySalesXlsx(buffer);
      const counts = await storage.upsertDailySales(rows);
      return { filename, reportType, ...counts, totalParsed: rows.length, dateRange };
    }
    case "order_pnl": {
      const { rows, dateRange } = parseOrderPnlXlsx(buffer);
      const counts = await storage.upsertOrderPnl(rows);
      return { filename, reportType, ...counts, totalParsed: rows.length, dateRange };
    }
    case "inventory": {
      const { rows } = parseInventoryXlsx(buffer);
      const counts = await storage.upsertInventory(rows);
      return { filename, reportType, ...counts, totalParsed: rows.length };
    }
    case "channel_sales": {
      const { rows } = parseChannelSalesXlsx(buffer);
      const counts = await storage.upsertChannelSales(rows);
      return { filename, reportType, ...counts, totalParsed: rows.length };
    }
    default:
      return {
        filename,
        reportType: "unknown",
        inserted: 0,
        updated: 0,
        unchanged: 0,
        totalParsed: 0,
        error: "Unknown report type",
      };
  }
}

export async function fetchEmailReports(
  daysBack: number = 3
): Promise<PipelineResult> {
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!user || !pass) {
    throw new Error(
      "Email not configured. Add IMAP_USER and IMAP_PASS in Replit Secrets."
    );
  }

  const result: PipelineResult = {
    emailsScanned: 0,
    reportsImported: 0,
    reports: [],
    errors: [],
  };

  let imap: Imap | null = null;

  try {
    console.log("[email] Pipeline started");

    imap = await imapConnect({
      user,
      password: pass,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    console.log("[email] Connected to imap.gmail.com");

    await imapOpenBox(imap, "INBOX");

    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const sinceStr = `${months[since.getMonth()]} ${since.getDate()}, ${since.getFullYear()}`;

    console.log(`[email] Searching for emails since ${sinceStr}`);

    const uids = await imapSearch(imap, [["SINCE", sinceStr]]);
    result.emailsScanned = uids.length;

    console.log(`[email] Found ${uids.length} emails since ${sinceStr}`);

    for (const uid of uids) {
      try {
        const parsed = await imapFetchOne(imap, uid);
        const subject = parsed.subject || "(no subject)";

        if (!parsed.attachments || parsed.attachments.length === 0) continue;

        for (const attachment of parsed.attachments) {
          const fname = attachment.filename || "";
          const isXlsx =
            fname.toLowerCase().endsWith(".xlsx") ||
            fname.toLowerCase().endsWith(".xls") ||
            (attachment.contentType &&
              (attachment.contentType.includes("spreadsheet") ||
                attachment.contentType.includes("excel")));

          if (!isXlsx) continue;

          const detectedType = detectReportType(fname);
          if (detectedType === "unknown") {
            console.log(
              `[email] Attachment: ${fname} - skipped (unknown report type)`
            );
            continue;
          }

          console.log(
            `[email] Processing: "${subject}" | Attachment: ${fname} -> detected as: ${detectedType}`
          );

          try {
            const importResult = await importBuffer(attachment.content, fname);

            if (importResult.error) {
              result.errors.push(`${fname}: ${importResult.error}`);
              console.log(`[email] Error: ${importResult.error}`);
            } else {
              result.reportsImported++;
              console.log(
                `[email] Imported: ${importResult.inserted} inserted, ${importResult.updated} updated`
              );
            }

            result.reports.push(importResult);
          } catch (parseErr: any) {
            const errMsg = `Failed to parse ${fname}: ${parseErr.message}`;
            result.errors.push(errMsg);
            console.log(`[email] ${errMsg}`);
            result.reports.push({
              filename: fname,
              reportType: detectedType,
              inserted: 0,
              updated: 0,
              unchanged: 0,
              totalParsed: 0,
              error: parseErr.message,
            });
          }
        }
      } catch (mailErr: any) {
        const errMsg = `Failed to process email UID ${uid}: ${mailErr.message}`;
        result.errors.push(errMsg);
        console.log(`[email] ${errMsg}`);
      }
    }

    console.log(
      `[email] Pipeline complete: ${result.reportsImported} reports imported from ${result.emailsScanned} emails`
    );
  } catch (err: any) {
    console.error("[email] Pipeline error:", err.message);
    throw err;
  } finally {
    if (imap) {
      try {
        imap.end();
      } catch {}
    }
  }

  return result;
}

import { db } from "./db";
import { sql } from "drizzle-orm";

async function logFetch(daysBack: number, emailsScanned: number, reportsImported: number, status: string = "success") {
  try {
    await db.execute(sql`INSERT INTO email_fetch_log (fetched_at, days_back, emails_scanned, reports_imported, status)
      VALUES (NOW(), ${daysBack}, ${emailsScanned}, ${reportsImported}, ${status})`);
  } catch (e: any) {
    console.error("[email] Failed to log fetch:", e.message);
  }
}

async function getLastFetchTime(): Promise<Date | null> {
  try {
    const rows = await db.execute(sql`SELECT fetched_at FROM email_fetch_log WHERE status = 'success' ORDER BY fetched_at DESC LIMIT 1`);
    if ((rows.rows as any[]).length > 0) {
      return new Date((rows.rows as any[])[0].fetched_at);
    }
  } catch (e: any) {
    console.error("[email] Failed to get last fetch time:", e.message);
  }
  return null;
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / 3600000;
}

let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

function getETOffset(date: Date): number {
  const etStr = date.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etStr);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const etMs = etDate.getTime();
  const offsetHours = Math.round((etMs - utcMs) / 3600000);
  return offsetHours;
}

function msUntilNextRun(targetHourUTC: number, targetMinute: number = 0): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(targetHourUTC, targetMinute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runFetchIfNeeded(source: string) {
  if (!process.env.IMAP_USER || !process.env.IMAP_PASS) return;

  const lastFetch = await getLastFetchTime();
  const hoursStale = lastFetch ? hoursSince(lastFetch) : 999;

  if (hoursStale < 12) {
    console.log(`[email] ${source}: Last fetch was ${hoursStale.toFixed(1)}h ago, skipping`);
    return;
  }

  const daysBack = Math.min(Math.max(Math.ceil(hoursStale / 24) + 1, 3), 14);
  console.log(`[email] ${source}: Last fetch was ${hoursStale.toFixed(1)}h ago, fetching ${daysBack} days back...`);

  try {
    const result = await fetchEmailReports(daysBack);
    await logFetch(daysBack, result.emailsScanned, result.reportsImported, "success");
    if (result.reportsImported > 0) {
      console.log(`[email] ${source}: ${result.reportsImported} reports imported from ${result.emailsScanned} emails`);
    } else {
      console.log(`[email] ${source}: No new reports found in ${result.emailsScanned} emails`);
    }
  } catch (err: any) {
    console.error(`[email] ${source} error:`, err.message);
    await logFetch(daysBack, 0, 0, `error: ${err.message}`);
  }
}

export async function startScheduledFetch() {
  if (scheduledTimer) clearTimeout(scheduledTimer);
  if (fallbackTimer) clearInterval(fallbackTimer);

  const targetHourET = 6;
  const now = new Date();
  const etOffset = getETOffset(now);
  const targetHourUTC = targetHourET - etOffset;

  const msUntil = msUntilNextRun(targetHourUTC);
  const hoursUntil = (msUntil / 3600000).toFixed(1);
  console.log(`[email] Scheduled daily fetch at 6:00 AM EST (next in ${hoursUntil}h)`);

  setTimeout(() => runFetchIfNeeded("startup-check"), 5000);

  function scheduleDailyTimer() {
    const delay = msUntilNextRun(targetHourUTC);
    scheduledTimer = setTimeout(async () => {
      await runFetchIfNeeded("daily-6am");
      scheduleDailyTimer();
    }, delay);
  }
  scheduleDailyTimer();

  fallbackTimer = setInterval(() => {
    runFetchIfNeeded("fallback-2h");
  }, 2 * 3600000);
}

export function stopScheduledFetch() {
  if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
}
