export interface ParsedSku {
  prefix: string;
  category: string;
  grade: string;
  bucket: string;
  productFamily: string;
}

const CATEGORY_MAP: Record<string, string> = {
  PA: "Phone", PKA: "Phone", PKO: "Phone",
  TA: "Tablet", TKA: "Tablet", TKO: "Tablet",
  LA: "Laptop", LKA: "Laptop", LKO: "Laptop",
  AA: "Accessory", AKA: "Accessory", AKO: "Accessory",
  CA: "Accessory", CKA: "Accessory",
  IA: "Accessory", IKA: "Accessory",
  HTR: "Accessory",
};

const KNOWN_GRADES = ["CAP1", "CAP", "CA+", "CA", "CAB", "SD-", "SD", "SDB", "XF", "XC"];

export function parseSku(sku: string): ParsedSku {
  if (!sku) {
    return { prefix: "", category: "Other", grade: "", bucket: "sellable", productFamily: sku || "" };
  }

  const raw = sku.trim();

  if (raw.toUpperCase().endsWith("-INTAKE")) {
    const base = raw.slice(0, raw.length - 7);
    const prefix = extractPrefix(base);
    return {
      prefix,
      category: CATEGORY_MAP[prefix] || "Other",
      grade: "INTAKE",
      bucket: "intake",
      productFamily: base,
    };
  }

  const prefix = extractPrefix(raw);
  const category = CATEGORY_MAP[prefix] || "Other";

  const parts = raw.split("-");
  let grade = "";
  let family = raw;

  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (KNOWN_GRADES.includes(lastPart.toUpperCase())) {
      grade = lastPart.toUpperCase();
      family = parts.slice(0, -1).join("-");
    }
  }

  let bucket = "sellable";
  if (grade === "XF" || grade === "XC") {
    bucket = "failed";
  }

  return { prefix, category, grade, bucket, productFamily: family };
}

function extractPrefix(sku: string): string {
  const colonIdx = sku.indexOf(":");
  if (colonIdx > 0) {
    return sku.substring(0, colonIdx);
  }
  const parts = sku.split("-");
  if (parts.length > 0) {
    const first = parts[0];
    for (const key of Object.keys(CATEGORY_MAP)) {
      if (first.toUpperCase() === key || first.toUpperCase().startsWith(key)) {
        return key;
      }
    }
    return first;
  }
  return "";
}

export function mapChannel(channelRaw: string, company: string): string {
  const ch = (channelRaw || "").trim();
  const co = (company || "").trim().toUpperCase();

  if (ch === "Website") {
    if (co.includes("REEBELO") || co.includes("REBELLO")) return "Rebello";
    if (co.includes("SWAPPA")) return "Swappa";
    return "BMP/Asurion";
  }
  if (ch === "BackMarket") return "Back Market";
  if (ch === "eBayOrder") return "eBay";
  if (ch === "Local_Store" || ch === "Wholesale") return "Wholesale/B2B";
  if (ch === "NewEggdotcom") return "NewEgg";
  if (ch === "FBA") return "Amazon FBA";
  if (ch === "Amazon") return "Amazon";
  if (ch === "Walmart_Marketplace") return "Walmart";
  if (ch === "Tanga") return "Tanga";
  return ch || "Unknown";
}
