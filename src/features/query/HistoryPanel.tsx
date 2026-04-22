import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Trash2, X } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/history";

interface Props {
  connectionId: string;
  onReplay?: (sql: string) => void;
}

export function HistoryPanel({ connectionId, onReplay }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await api.listHistory(300);
      setEntries(all.filter((e) => e.connection_id === connectionId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  const handleClear = async () => {
    if (!confirm("Clear all query history (across all connections)?")) return;
    await api.clearHistory();
    await load();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {entries == null
            ? "Loading…"
            : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="Refresh"
            onClick={load}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="Clear all history"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}

        {!loading && entries?.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">
            No queries run for this connection yet.
          </p>
        )}

        {!loading &&
          entries?.map((e) => (
            <button
              key={e.id}
              onClick={() => onReplay?.(e.sql)}
              className={cn(
                "block w-full border-b border-border/60 px-3 py-2 text-left text-xs hover:bg-accent"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {e.success ? (
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-3 w-3 text-destructive" />
                  )}
                  <span className="text-muted-foreground">
                    {formatTime(e.executed_at)}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {e.success
                    ? `${e.row_count ?? "?"} rows · ${e.elapsed_ms} ms`
                    : `failed · ${e.elapsed_ms} ms`}
                </span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px]">
                {truncate(e.sql, 240)}
              </pre>
              {e.error && (
                <div className="mt-1 truncate text-[11px] text-destructive">
                  {truncate(e.error, 160)}
                </div>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
