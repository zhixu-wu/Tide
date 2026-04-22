import { useEffect, useState } from "react";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/store/connection-store";
import type { Connection } from "@/types/connection";

import { ConnectionFormDialog } from "./ConnectionFormDialog";

export function ConnectionList() {
  const { connections, activeId, loading, refresh, setActive, remove } =
    useConnectionStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Connection) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const handleDelete = async (c: Connection) => {
    if (!confirm(`Delete connection "${c.name}"?`)) return;
    await remove(c.id);
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-muted/20">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Connections
        </h2>
        <Button size="icon" variant="ghost" onClick={openNew} title="New connection">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && (
          <p className="px-2 text-xs text-muted-foreground">Loading…</p>
        )}
        {!loading && connections.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            No connections yet. Click <span className="font-medium">+</span> to
            add one.
          </p>
        )}
        <ul className="space-y-0.5">
          {connections.map((c) => (
            <li
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                c.id === activeId && "bg-accent"
              )}
              onClick={() => setActive(c.id)}
            >
              <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.host}:{c.port}
                </div>
              </div>
              <button
                className="invisible rounded p-1 hover:bg-background group-hover:visible"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(c);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className="invisible rounded p-1 hover:bg-background group-hover:visible"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(c);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ConnectionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={refresh}
      />
    </aside>
  );
}
