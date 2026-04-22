export interface ColumnMeta {
  name: string;
  data_type: string;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Record<string, string | null>[];
  row_count: number;
  elapsed_ms: number;
  truncated: boolean;
}
