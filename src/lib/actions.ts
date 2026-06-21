import { useCallback } from "react";
import {
  buildWhatsAppSummary,
  copyText,
  exportCSV,
  exportExcel,
} from "./engine";

/** Shared export actions used by every dashboard. */
export function useDashboardExports() {
  const exportTable = useCallback(
    async (fileName: string, rows: Record<string, unknown>[], fmt: "csv" | "xlsx") => {
      const base = rows.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
            v,
          ])
        )
      );
      if (fmt === "csv") exportCSV(fileName, base);
      else await exportExcel(fileName, base);
    },
    []
  );

  const copyWhatsApp = useCallback(
    async (title: string, summary: { label: string; value: string | number }[], extra?: string) => {
      const msg = buildWhatsAppSummary(title, summary, extra ? [extra] : []);
      await copyText(msg);
    },
    []
  );

  return { exportTable, copyWhatsApp };
}
