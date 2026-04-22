import { useState } from "react";
import { Database } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ConnectionList } from "@/features/connection/ConnectionList";
import { ResourceBrowser } from "@/features/explorer/ResourceBrowser";
import { QueryPanel } from "@/features/query/QueryPanel";
import { useConnectionStore } from "@/store/connection-store";
import "./App.css";

function App() {
  const activeId = useConnectionStore((s) => s.activeId);
  const active = useConnectionStore(
    (s) => s.connections.find((c) => c.id === s.activeId) ?? null
  );

  const [pendingTemplate, setPendingTemplate] = useState<string>(
    "SELECT 1"
  );

  const handleSelectTable = (schema: string, table: string) => {
    setPendingTemplate(
      `SELECT * FROM "${schema}"."${table}" ORDER BY time DESC LIMIT 100`
    );
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <ConnectionList />
      {active && <ResourceBrowser onSelectTable={handleSelectTable} />}

      <main className="flex flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{active.name}</span>
              <span className="text-xs text-muted-foreground">
                {active.host}:{active.port}
                {active.database ? ` / ${active.database}` : ""}
              </span>
              <div className="flex-1" />
              <ThemeToggle />
            </div>
            <div className="min-h-0 flex-1">
              <QueryPanel
                connectionId={active.id}
                initialSql={pendingTemplate}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="absolute right-3 top-3">
              <ThemeToggle />
            </div>
            <div className="max-w-sm text-center">
              <Database className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-sm font-semibold">
                No connection selected
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeId
                  ? "The selected connection is missing. Pick another from the sidebar."
                  : "Create a connection in the sidebar to get started."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
