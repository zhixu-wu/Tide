import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type {
  Connection,
  ConnectionInput,
  TestConnectionResult,
} from "@/types/connection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Connection | null;
  onSaved?: () => void;
}

const emptyForm = (): ConnectionInput => ({
  name: "",
  host: "localhost",
  port: 8181,
  token: "",
  database: "",
  use_tls: false,
});

export function ConnectionFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: Props) {
  const [form, setForm] = useState<ConnectionInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] =
    useState<TestConnectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id: editing.id,
        name: editing.name,
        host: editing.host,
        port: editing.port,
        token: "", // never show; user must re-enter to save
        database: editing.database ?? "",
        use_tls: editing.use_tls,
      });
    } else {
      setForm(emptyForm());
    }
    setTestResult(null);
    setError(null);
  }, [open, editing]);

  const update = <K extends keyof ConnectionInput>(
    key: K,
    value: ConnectionInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const r = await api.testConnection(form);
      setTestResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveConnection(form);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? "Edit connection" : "New connection";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Connect to an InfluxDB 3.x instance via FlightSQL.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="My InfluxDB"
            />
          </Field>

          <div className="grid grid-cols-[1fr,120px] gap-3">
            <Field label="Host">
              <Input
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
                placeholder="localhost"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={form.port}
                onChange={(e) =>
                  update("port", Number(e.target.value) || 0)
                }
              />
            </Field>
          </div>

          <Field label="Token">
            <Input
              type="password"
              value={form.token}
              onChange={(e) => update("token", e.target.value)}
              placeholder="InfluxDB 3.x API token"
              autoComplete="off"
            />
          </Field>

          <Field label="Database">
            <Input
              value={form.database ?? ""}
              onChange={(e) => update("database", e.target.value)}
              placeholder="e.g. monitoring"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Use TLS</Label>
              <p className="text-xs text-muted-foreground">
                Enable for https:// endpoints (e.g. InfluxDB Cloud).
              </p>
            </div>
            <Switch
              checked={form.use_tls}
              onCheckedChange={(v) => update("use_tls", v)}
            />
          </div>

          {testResult && (
            <div
              className={
                "rounded-md border p-2 text-xs " +
                (testResult.ok
                  ? "border-green-600/40 text-green-700 dark:text-green-400"
                  : "border-destructive/40 text-destructive")
              }
            >
              {testResult.message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button onClick={handleSave} disabled={saving || testing}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
