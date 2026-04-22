import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridOptions,
  themeQuartz,
  colorSchemeLightCold,
  colorSchemeDarkBlue,
} from "ag-grid-community";

import type { QueryResult } from "@/types/query";

// AG Grid 33+ requires explicit module registration. We register once at
// module load; re-registering is cheap and idempotent.
ModuleRegistry.registerModules([AllCommunityModule]);

const lightTheme = themeQuartz.withPart(colorSchemeLightCold);
const darkTheme = themeQuartz.withPart(colorSchemeDarkBlue);

interface Props {
  result: QueryResult;
  dark?: boolean;
}

export function ResultGrid({ result, dark = false }: Props) {
  const columnDefs = useMemo<ColDef[]>(
    () =>
      result.columns.map((c) => ({
        field: c.name,
        headerName: c.name,
        headerTooltip: c.data_type,
        sortable: true,
        resizable: true,
        filter: true,
        minWidth: 80,
        // Render null values with a muted marker.
        cellRenderer: (p: { value: unknown }) =>
          p.value == null ? (
            <span className="italic text-muted-foreground">null</span>
          ) : (
            String(p.value)
          ),
      })),
    [result.columns]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      suppressMovable: false,
      cellStyle: { fontFamily: "ui-monospace, SFMono-Regular, monospace" },
    }),
    []
  );

  const gridOptions = useMemo<GridOptions>(
    () => ({
      animateRows: false,
      // Allow users to drag-select text inside a cell (Cmd/Ctrl+C copies it)
      // and to copy full rows / ranges from the built-in clipboard handler.
      enableCellTextSelection: true,
      ensureDomOrder: true,
      copyHeadersToClipboard: false,
      // Row data changes trigger an expensive diff by default; for ad-hoc
      // queries we always swap the entire dataset.
      suppressColumnVirtualisation: false,
    }),
    []
  );

  if (result.columns.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        Query returned no columns.
      </p>
    );
  }

  return (
    <div className="h-full w-full">
      <AgGridReact
        theme={dark ? darkTheme : lightTheme}
        columnDefs={columnDefs}
        rowData={result.rows}
        defaultColDef={defaultColDef}
        gridOptions={gridOptions}
        rowHeight={26}
        headerHeight={32}
      />
    </div>
  );
}
