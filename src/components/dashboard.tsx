import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  MessageCircle,
  Search,
} from "lucide-react";
import type { DeptSummaryRow, RiskLevel } from "../types";
import { useDashboardExports } from "../lib/actions";

export interface FilterState {
  search: string;
  department: string;
  risk: RiskLevel | "all";
  status: string | "all";
  zone: string | "all";
  dateFrom: string;
  dateTo: string;
}

export const emptyFilter: FilterState = {
  search: "",
  department: "all",
  risk: "all",
  status: "all",
  zone: "all",
  dateFrom: "",
  dateTo: "",
};

export function filterRows(rows: DeptSummaryRow[], f: FilterState): DeptSummaryRow[] {
  return rows.filter((r) => {
    if (f.department !== "all" && r.dept_id !== f.department) return false;
    if (f.risk !== "all" && r.risk !== f.risk) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (
        !r.dept_id.toLowerCase().includes(q) &&
        !r.dept_name.toLowerCase().includes(q) &&
        !(r.hypothesis ?? "").toLowerCase().includes(q) &&
        !(r.action_taken ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

/** Generic filter state + setters, used by every dashboard. */
export function useFilters() {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [status, setStatus] = useState("all");
  const [zone, setZone] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  return {
    filter: { search, department, risk, status, zone, dateFrom, dateTo } as FilterState,
    setSearch, setDepartment, setRisk, setStatus, setZone, setDateFrom, setDateTo,
  };
}

export function FilterBar({
  filter,
  setters,
  departments,
  showStatus = false,
  showRisk = true,
  showZone = false,
  showDateRange = false,
  exportName,
  rows,
  waSummary,
}: {
  filter: FilterState;
  setters: Record<string, (v: string) => void>;
  departments?: string[];
  showStatus?: boolean;
  showRisk?: boolean;
  showZone?: boolean;
  showDateRange?: boolean;
  exportName: string;
  rows: Record<string, unknown>[];
  waSummary: { label: string; value: string | number }[];
}) {
  const { exportTable, copyWhatsApp } = useDashboardExports();
  const [copying, setCopying] = useState(false);
  const zones = ["France", "Europe", "Trecate", "Autre"];

  return (
    <div className="card p-3 flex flex-col xl:flex-row gap-3 xl:items-center flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
        <input
          value={filter.search}
          onChange={(e) => setters.setSearch(e.target.value)}
          placeholder="Rechercher SKU, référence, département…"
          className="input pl-9"
        />
      </div>
      {departments && (
        <select
          value={filter.department}
          onChange={(e) => setters.setDepartment(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Tous départements</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {showZone && (
        <select
          value={filter.zone}
          onChange={(e) => setters.setZone(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Toutes destinations</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      {showRisk && (
        <select
          value={filter.risk}
          onChange={(e) => setters.setRisk(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Tous risques</option>
          <option value="ok">OK</option>
          <option value="attention">Attention</option>
          <option value="action">Action requise</option>
        </select>
      )}
      {showStatus && (
        <select
          value={filter.status}
          onChange={(e) => setters.setStatus(e.target.value)}
          className="select w-auto"
        >
          <option value="all">Tous statuts</option>
          <option value="open">Ouvert</option>
          <option value="in_progress">En cours</option>
          <option value="closed">Clôturé</option>
        </select>
      )}
      {showDateRange && (
        <div className="flex items-center gap-1">
          <input type="date" value={filter.dateFrom} onChange={(e) => setters.setDateFrom(e.target.value)} className="input w-auto py-1.5" />
          <span className="text-graphite-400 text-xs">→</span>
          <input type="date" value={filter.dateTo} onChange={(e) => setters.setDateTo(e.target.value)} className="input w-auto py-1.5" />
        </div>
      )}
      <div className="flex gap-1.5 xl:ml-auto">
        <button
          className="btn-ghost text-sm"
          onClick={() => exportTable(`${exportName}.csv`, rows, "csv")}
          title="Export CSV"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
        <button
          className="btn-ghost text-sm"
          onClick={() => exportTable(`${exportName}.xlsx`, rows, "xlsx")}
          title="Export Excel"
        >
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </button>
        <button
          className="btn-dark text-sm"
          onClick={async () => {
            setCopying(true);
            try { await copyWhatsApp(exportName, waSummary); } finally { setCopying(false); }
          }}
          disabled={copying}
          title="Copier résumé WhatsApp"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </button>
      </div>
    </div>
  );
}

export function useFilteredRows<T>(rows: T[], predicate: (r: T) => boolean): T[] {
  return useMemo(() => rows.filter(predicate), [rows, predicate]);
}

/** Helper: total a numeric field across dept summary rows. */
export function sumField(rows: DeptSummaryRow[], field: keyof DeptSummaryRow): number {
  return rows.reduce((a, r) => a + (typeof r[field] === "number" ? (r[field] as number) : 0), 0);
}
