import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

import { cn } from "@/lib/utils";
import type { QueryResult, ColumnMeta } from "@/types/query";

interface Props {
  result: QueryResult;
  dark?: boolean;
}

const NUMERIC_TYPES = [
  "Int",
  "UInt",
  "Float",
  "Decimal",
  "Double",
];

function isNumericType(dt: string): boolean {
  return NUMERIC_TYPES.some((t) => dt.startsWith(t));
}

function isTimeType(dt: string): boolean {
  return dt.startsWith("Timestamp") || dt.startsWith("Date");
}

function pickDefaultX(columns: ColumnMeta[]): string | null {
  // Prefer a column named 'time', then first Timestamp column, else null.
  const byName = columns.find((c) => c.name.toLowerCase() === "time");
  if (byName) return byName.name;
  const byType = columns.find((c) => isTimeType(c.data_type));
  return byType?.name ?? null;
}

function pickDefaultYs(columns: ColumnMeta[], xName: string | null): string[] {
  return columns
    .filter((c) => c.name !== xName && isNumericType(c.data_type))
    .slice(0, 4)
    .map((c) => c.name);
}

export function ChartView({ result, dark = false }: Props) {
  const defaultX = useMemo(
    () => pickDefaultX(result.columns),
    [result.columns]
  );

  const [xName, setXName] = useState<string | null>(defaultX);
  const [yNames, setYNames] = useState<string[]>(() =>
    pickDefaultYs(result.columns, defaultX)
  );

  const numericCols = useMemo(
    () => result.columns.filter((c) => isNumericType(c.data_type)),
    [result.columns]
  );

  const timeCols = useMemo(
    () =>
      result.columns.filter(
        (c) => isTimeType(c.data_type) || c.name.toLowerCase() === "time"
      ),
    [result.columns]
  );

  // Rebuild chart data when axes change.
  const option = useMemo(() => {
    if (!xName || yNames.length === 0) return null;

    // Values come back from the backend as strings (via Arrow formatter).
    // Parse to number for Y; keep original string for X and let ECharts treat
    // it as time if possible.
    const xValues = result.rows.map((r) => r[xName] ?? "");
    const series = yNames.map((yn) => ({
      name: yn,
      type: "line" as const,
      showSymbol: false,
      sampling: "lttb" as const,
      data: result.rows.map((r) => {
        const raw = r[yn];
        if (raw == null || raw === "") return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }),
    }));

    const xIsTime = isTimeType(
      result.columns.find((c) => c.name === xName)?.data_type ?? ""
    );

    return {
      grid: { top: 20, right: 16, bottom: 40, left: 50, containLabel: true },
      tooltip: { trigger: "axis" as const },
      legend: { top: 0, right: 16, textStyle: { color: dark ? "#e5e7eb" : "#111" } },
      xAxis: {
        type: xIsTime ? ("time" as const) : ("category" as const),
        data: xIsTime ? undefined : xValues,
        axisLabel: { color: dark ? "#a1a1aa" : "#525252" },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { color: dark ? "#a1a1aa" : "#525252" },
        splitLine: { lineStyle: { color: dark ? "#27272a" : "#e5e7eb" } },
      },
      series: xIsTime
        ? series.map((s) => ({
            ...s,
            data: s.data.map((v, i) => [xValues[i], v]),
          }))
        : series,
      backgroundColor: "transparent",
    };
  }, [result.rows, result.columns, xName, yNames, dark]);

  if (timeCols.length === 0 && !xName) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        No time column detected. Add one to your SELECT (e.g. <code>time</code>)
        to plot a chart.
      </p>
    );
  }

  if (numericCols.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        No numeric columns in the result set — nothing to chart.
      </p>
    );
  }

  const toggleY = (name: string) => {
    setYNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">X:</span>
          <select
            className="rounded border border-input bg-background px-1.5 py-0.5"
            value={xName ?? ""}
            onChange={(e) => setXName(e.target.value || null)}
          >
            {timeCols.length === 0 && <option value="">(none)</option>}
            {result.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Y:</span>
          {numericCols.map((c) => (
            <button
              key={c.name}
              onClick={() => toggleY(c.name)}
              className={cn(
                "rounded border px-1.5 py-0.5",
                yNames.includes(c.name)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {option ? (
          <ReactECharts
            option={option}
            theme={dark ? "dark" : undefined}
            style={{ height: "100%", width: "100%" }}
            notMerge
            opts={{ renderer: "canvas" }}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">
            Pick at least one Y column to plot.
          </p>
        )}
      </div>
    </div>
  );
}
