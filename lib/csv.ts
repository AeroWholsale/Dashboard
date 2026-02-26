export function downloadCsv(rows: Record<string, any>[], headers: { key: string; label: string }[], filename: string) {
  if (!rows.length) return;

  const headerLine = headers.map(h => `"${h.label}"`).join(",");
  const dataLines = rows.map(row =>
    headers.map(h => {
      const val = row[h.key];
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
      return val;
    }).join(",")
  );

  const csv = [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
