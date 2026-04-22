export interface HistoryEntry {
  id: string;
  connection_id: string;
  sql: string;
  executed_at: number;
  success: boolean;
  elapsed_ms: number;
  row_count: number | null;
  error: string | null;
}
