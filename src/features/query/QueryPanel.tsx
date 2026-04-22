import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Download, History, LineChart, Loader2, Play, Table } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { exportResult, type ExportFormat } from "@/lib/export";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import type { QueryResult } from "@/types/query";

import { ChartView } from "./ChartView";
import { HistoryPanel } from "./HistoryPanel";
import { ResultGrid } from "./ResultGrid";

type BottomTab = "results" | "chart" | "history";

interface Props {
  connectionId: string;
  initialSql?: string;
}

export function QueryPanel({ connectionId, initialSql }: Props) {
  const [sql, setSql] = useState(initialSql ?? "SELECT 1");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolvedTheme = useThemeStore((s) => s.resolved);

  // Replace editor contents whenever a new template arrives from outside.
  // (Without this, double-clicking a different table wouldn't update the editor
  // because we'd keep its uncontrolled buffer.)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  useEffect(() => {
    if (initialSql !== undefined) {
      setSql(initialSql);
      editorRef.current?.setValue(initialSql);
    }
  }, [initialSql]);

  const handleRun = useCallback(async () => {
    const value = editorRef.current?.getValue() ?? sql;
    if (!value.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const r = await api.runQuery(connectionId, value);
      setResult(r);
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [connectionId, sql]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        void handleRun();
      }
    );
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const handleExport = async (format: ExportFormat) => {
    if (!result) return;
    setExportMenuOpen(false);
    try {
      await exportResult(result, format);
    } catch (e) {
      setError(`Export failed: ${e}`);
    }
  };

  const [bottomTab, setBottomTab] = useState<BottomTab>("results");
  // Auto-switch to results whenever a new run completes (or errors).
  useEffect(() => {
    if (result || error) setBottomTab("results");
  }, [result, error]);

  const replayFromHistory = (replaySql: string) => {
    setSql(replaySql);
    editorRef.current?.setValue(replaySql);
    setBottomTab("results");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button size="sm" onClick={handleRun} disabled={running}>
          {running ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Run
        </Button>
        <span className="text-xs text-muted-foreground">
          ⌘/Ctrl + Enter
        </span>
        <div className="flex-1" />
        {result && !error && (
          <>
            <span className="text-xs text-muted-foreground">
              {result.row_count} row{result.row_count === 1 ? "" : "s"}
              {result.truncated && " (truncated)"} · {result.elapsed_ms} ms
            </span>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportMenuOpen((o) => !o)}
                disabled={result.rows.length === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
              {exportMenuOpen && (
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-border bg-popover shadow-md"
                  onMouseLeave={() => setExportMenuOpen(false)}
                >
                  {(["csv", "json", "ndjson"] as ExportFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => handleExport(f)}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      {f === "ndjson" ? "NDJSON (.ndjson)" : `${f.toUpperCase()} (.${f})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="h-64 min-h-40 border-b border-border">
        <Editor
          defaultLanguage="sql"
          value={sql}
          theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          onMount={handleMount}
          onChange={(v) => setSql(v ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-0 border-b border-border px-2 py-1 text-xs">
          <TabButton
            active={bottomTab === "results"}
            onClick={() => setBottomTab("results")}
            icon={<Table className="h-3 w-3" />}
          >
            Results
          </TabButton>
          <TabButton
            active={bottomTab === "chart"}
            onClick={() => setBottomTab("chart")}
            icon={<LineChart className="h-3 w-3" />}
          >
            Chart
          </TabButton>
          <TabButton
            active={bottomTab === "history"}
            onClick={() => setBottomTab("history")}
            icon={<History className="h-3 w-3" />}
          >
            History
          </TabButton>
        </div>

        {bottomTab === "results" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {error && (
              <div className="m-3 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                <div className="font-medium">Query failed</div>
                <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
              </div>
            )}

            {!error && !result && (
              <p className="p-4 text-xs text-muted-foreground">
                Run a query to see results.
              </p>
            )}

            {!error && result && (
              <ResultGrid result={result} dark={resolvedTheme === "dark"} />
            )}
          </div>
        )}

        {bottomTab === "chart" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {!result ? (
              <p className="p-4 text-xs text-muted-foreground">
                Run a query to plot its result.
              </p>
            ) : (
              <ChartView result={result} dark={resolvedTheme === "dark"} />
            )}
          </div>
        )}

        {bottomTab === "history" && (
          <HistoryPanel
            connectionId={connectionId}
            onReplay={replayFromHistory}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded px-2 py-1 text-xs",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/50"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
