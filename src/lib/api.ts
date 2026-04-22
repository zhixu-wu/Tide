import { invoke } from "@tauri-apps/api/core";

import type {
  Connection,
  ConnectionInput,
  TestConnectionResult,
} from "@/types/connection";
import type { ColumnInfo, TableInfo } from "@/types/metadata";
import type { HistoryEntry } from "@/types/history";
import type { QueryResult } from "@/types/query";

export const api = {
  // connection
  listConnections: () => invoke<Connection[]>("list_connections"),
  saveConnection: (input: ConnectionInput) =>
    invoke<Connection>("save_connection", { input }),
  deleteConnection: (id: string) =>
    invoke<void>("delete_connection", { id }),
  testConnection: (input: ConnectionInput) =>
    invoke<TestConnectionResult>("test_connection", { input }),
  testSavedConnection: (id: string) =>
    invoke<TestConnectionResult>("test_saved_connection", { id }),

  // metadata
  listSchemas: (connectionId: string) =>
    invoke<string[]>("list_schemas", { connectionId }),
  listTables: (connectionId: string, schema?: string) =>
    invoke<TableInfo[]>("list_tables", { connectionId, schema }),
  listColumns: (connectionId: string, schema: string, table: string) =>
    invoke<ColumnInfo[]>("list_columns", { connectionId, schema, table }),

  // query
  runQuery: (connectionId: string, sql: string, rowLimit?: number) =>
    invoke<QueryResult>("run_query", { connectionId, sql, rowLimit }),
  listHistory: (limit?: number) =>
    invoke<HistoryEntry[]>("list_history", { limit }),
  clearHistory: () => invoke<void>("clear_history"),
};
