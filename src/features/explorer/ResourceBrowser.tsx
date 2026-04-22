import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/store/connection-store";
import type { ColumnInfo, TableInfo } from "@/types/metadata";

interface TreeState {
  schemas: string[] | null;
  schemaLoading: boolean;
  tablesBySchema: Record<string, TableInfo[] | undefined>;
  tableLoading: Record<string, boolean>;
  columnsByTable: Record<string, ColumnInfo[] | undefined>;
  columnLoading: Record<string, boolean>;
  error: string | null;
}

const initialTreeState: TreeState = {
  schemas: null,
  schemaLoading: false,
  tablesBySchema: {},
  tableLoading: {},
  columnsByTable: {},
  columnLoading: {},
  error: null,
};

const tableKey = (schema: string, table: string) => `${schema}.${table}`;

interface Props {
  onSelectTable?: (schema: string, table: string) => void;
}

export function ResourceBrowser({ onSelectTable }: Props) {
  const activeId = useConnectionStore((s) => s.activeId);
  const active = useConnectionStore(
    (s) => s.connections.find((c) => c.id === s.activeId) ?? null
  );

  const [state, setState] = useState<TreeState>(initialTreeState);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set()
  );
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const loadSchemas = useCallback(async () => {
    if (!activeId) return;
    setState((s) => ({ ...s, schemaLoading: true, error: null }));
    try {
      const schemas = await api.listSchemas(activeId);
      setState((s) => ({ ...s, schemas, schemaLoading: false }));
      if (schemas.length === 1) {
        setExpandedSchemas(new Set(schemas));
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        schemaLoading: false,
        error: String(e),
      }));
    }
  }, [activeId]);

  // Reset and reload when the active connection changes.
  useEffect(() => {
    setState(initialTreeState);
    setExpandedSchemas(new Set());
    setExpandedTables(new Set());
    setSearch("");
    if (activeId) {
      loadSchemas();
    }
  }, [activeId, loadSchemas]);

  // When the user types in the search box, eagerly load tables for every
  // schema (so we can match table names the user has never expanded).
  useEffect(() => {
    if (!search.trim() || !activeId || !state.schemas) return;
    for (const schema of state.schemas) {
      if (state.tablesBySchema[schema] || state.tableLoading[schema]) continue;
      setState((s) => ({
        ...s,
        tableLoading: { ...s.tableLoading, [schema]: true },
      }));
      api
        .listTables(activeId, schema)
        .then((tables) =>
          setState((s) => ({
            ...s,
            tablesBySchema: { ...s.tablesBySchema, [schema]: tables },
            tableLoading: { ...s.tableLoading, [schema]: false },
          }))
        )
        .catch((e) =>
          setState((s) => ({
            ...s,
            tableLoading: { ...s.tableLoading, [schema]: false },
            error: String(e),
          }))
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeId, state.schemas]);

  // Filter + collect schemas/tables to render. When searching, every matching
  // schema is considered expanded regardless of the user's prior toggles.
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  const visibleSchemas = useMemo(() => {
    if (!state.schemas) return [];
    if (!searching) return state.schemas;
    return state.schemas.filter((schema) => {
      if (schema.toLowerCase().includes(query)) return true;
      const tables = state.tablesBySchema[schema];
      return tables?.some((t) => t.name.toLowerCase().includes(query)) ?? false;
    });
  }, [state.schemas, state.tablesBySchema, query, searching]);

  const filteredTables = (schema: string): TableInfo[] | undefined => {
    const all = state.tablesBySchema[schema];
    if (!all || !searching) return all;
    // If the schema name itself matched, show all of its tables (user likely
    // wants to browse within that schema). Otherwise filter to matching tables.
    if (schema.toLowerCase().includes(query)) return all;
    return all.filter((t) => t.name.toLowerCase().includes(query));
  };

  const toggleSchema = async (schema: string) => {
    const next = new Set(expandedSchemas);
    if (next.has(schema)) {
      next.delete(schema);
      setExpandedSchemas(next);
      return;
    }
    next.add(schema);
    setExpandedSchemas(next);

    if (!activeId) return;
    if (state.tablesBySchema[schema]) return;

    setState((s) => ({
      ...s,
      tableLoading: { ...s.tableLoading, [schema]: true },
    }));
    try {
      const tables = await api.listTables(activeId, schema);
      setState((s) => ({
        ...s,
        tablesBySchema: { ...s.tablesBySchema, [schema]: tables },
        tableLoading: { ...s.tableLoading, [schema]: false },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        tableLoading: { ...s.tableLoading, [schema]: false },
        error: String(e),
      }));
    }
  };

  const toggleTable = async (schema: string, table: string) => {
    const key = tableKey(schema, table);
    const next = new Set(expandedTables);
    if (next.has(key)) {
      next.delete(key);
      setExpandedTables(next);
      return;
    }
    next.add(key);
    setExpandedTables(next);

    if (!activeId) return;
    if (state.columnsByTable[key]) return;

    setState((s) => ({
      ...s,
      columnLoading: { ...s.columnLoading, [key]: true },
    }));
    try {
      const columns = await api.listColumns(activeId, schema, table);
      setState((s) => ({
        ...s,
        columnsByTable: { ...s.columnsByTable, [key]: columns },
        columnLoading: { ...s.columnLoading, [key]: false },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        columnLoading: { ...s.columnLoading, [key]: false },
        error: String(e),
      }));
    }
  };

  if (!active) return null;

  return (
    <div className="flex h-full w-72 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {active.database ?? "—"}
          </h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {active.name}
          </p>
        </div>
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent"
          title="Refresh"
          onClick={() => {
            setState(initialTreeState);
            setExpandedSchemas(new Set());
            setExpandedTables(new Set());
            loadSchemas();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative px-2 pb-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables…"
          className="h-7 pl-7 pr-7 text-xs"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {search && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
            title="Clear"
            onClick={() => setSearch("")}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 text-sm">
        {state.schemaLoading && (
          <Row indent={0}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading schemas…</span>
          </Row>
        )}

        {state.error && (
          <div className="m-1 rounded border border-destructive/40 p-2 text-xs text-destructive">
            {state.error}
          </div>
        )}

        {state.schemas?.length === 0 && !state.schemaLoading && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No schemas found.
          </p>
        )}

        {state.schemas && visibleSchemas.length === 0 && searching && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No tables matching "{search}".
          </p>
        )}

        {visibleSchemas.map((schema) => {
          const open = searching || expandedSchemas.has(schema);
          const tables = filteredTables(schema);
          return (
            <div key={schema}>
              <Row indent={0} onClick={() => !searching && toggleSchema(schema)}>
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-medium">{schema}</span>
              </Row>

              {open && state.tableLoading[schema] && (
                <Row indent={1}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading tables…</span>
                </Row>
              )}

              {open &&
                tables?.map((t) => {
                  const key = tableKey(t.schema, t.name);
                  const tableOpen = expandedTables.has(key);
                  const cols = state.columnsByTable[key];
                  return (
                    <div key={key}>
                      <Row
                        indent={1}
                        onClick={() => toggleTable(t.schema, t.name)}
                        onDoubleClick={() =>
                          onSelectTable?.(t.schema, t.name)
                        }
                      >
                        {tableOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">
                          {highlight(t.name, query)}
                        </span>
                      </Row>

                      {tableOpen && state.columnLoading[key] && (
                        <Row indent={2}>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Loading columns…
                          </span>
                        </Row>
                      )}

                      {tableOpen &&
                        cols?.map((c) => (
                          <Row indent={2} key={c.name}>
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{c.name}</span>
                            <span className="ml-auto truncate text-[11px] text-muted-foreground">
                              {shortenType(c.data_type)}
                            </span>
                          </Row>
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <Columns3 className="mr-1 inline h-3 w-3" />
        Double-click a table to insert a SELECT template.
      </div>
    </div>
  );
}

function Row({
  indent,
  children,
  onClick,
  onDoubleClick,
  className,
}: {
  indent: number;
  children: React.ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-1 py-1 text-[13px]",
        onClick && "cursor-pointer hover:bg-accent",
        className
      )}
      style={{ paddingLeft: 4 + indent * 14 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

/**
 * Trim Arrow type names for display:
 *   Dictionary(Int32, Utf8) -> tag (Utf8)
 *   Timestamp(Nanosecond, None) -> Timestamp(ns)
 */
function shortenType(t: string): string {
  if (t.startsWith("Dictionary")) {
    const inner = t.match(/Utf8|LargeUtf8/)?.[0] ?? "dict";
    return `tag(${inner})`;
  }
  if (t.startsWith("Timestamp")) {
    if (t.includes("Nanosecond")) return "time(ns)";
    if (t.includes("Microsecond")) return "time(μs)";
    if (t.includes("Millisecond")) return "time(ms)";
    return "time";
  }
  return t;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx < 0) return text;
  const end = idx + query.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 text-foreground">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
