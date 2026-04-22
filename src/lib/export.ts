import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

import type { QueryResult } from "@/types/query";

export type ExportFormat = "csv" | "json" | "ndjson";

export async function exportResult(
  result: QueryResult,
  format: ExportFormat,
  defaultName = "query-result"
): Promise<string | null> {
  const ext = format === "ndjson" ? "ndjson" : format;
  const path = await save({
    defaultPath: `${defaultName}.${ext}`,
    filters: [{ name: format.toUpperCase(), extensions: [ext] }],
  });
  if (!path) return null;

  const content = serialize(result, format);
  await writeTextFile(path, content);
  return path;
}

function serialize(result: QueryResult, format: ExportFormat): string {
  const cols = result.columns.map((c) => c.name);
  switch (format) {
    case "csv":
      return toCsv(cols, result.rows);
    case "json":
      return JSON.stringify(result.rows, null, 2);
    case "ndjson":
      return result.rows.map((r) => JSON.stringify(r)).join("\n");
  }
}

function toCsv(cols: string[], rows: QueryResult["rows"]): string {
  const header = cols.map(csvCell).join(",");
  const body = rows
    .map((r) => cols.map((c) => csvCell(r[c] ?? "")).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
