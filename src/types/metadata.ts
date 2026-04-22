export interface TableInfo {
  schema: string;
  name: string;
  table_type: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  influx_type?: string | null;
}
