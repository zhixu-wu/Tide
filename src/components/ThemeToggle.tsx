import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "@/store/theme-store";

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground",
              theme === o.value && "bg-accent text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
