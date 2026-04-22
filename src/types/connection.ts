export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  database?: string | null;
  use_tls: boolean;
}

export interface ConnectionInput {
  id?: string;
  name: string;
  host: string;
  port: number;
  token: string;
  database?: string | null;
  use_tls: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  server_version?: string | null;
}
