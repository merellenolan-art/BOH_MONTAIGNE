import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCitesItems,
  fetchDepartments,
  fetchDeptNotes,
  fetchFileTypes,
  fetchImports,
  fetchKpiOverrides,
  fetchMappings,
  fetchPackagingItems,
  fetchSummary,
  rebuildSummary,
} from "./data";
import { demoDepartments, demoDeptSummary } from "./engine";
import type {
  CitesItem,
  Department,
  DeptNote,
  DeptSummaryRow,
  FileType,
  ImportRecord,
  KpiOverride,
  MappingRecord,
  PackagingItem,
} from "../types";

const DEMO_DEPTS = demoDepartments();
const DEMO_DEPT_NOTES: DeptNote[] = [];

export interface StoreState {
  fileTypes: FileType[];
  imports: ImportRecord[];
  mappings: MappingRecord[];
  summary: DeptSummaryRow[];
  departments: Department[];
  notes: DeptNote[];
  kpis: KpiOverride[];
  citesItems: CitesItem[];
  packagingItems: PackagingItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useStore(): StoreState {
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [summary, setSummary] = useState<DeptSummaryRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [notes, setNotes] = useState<DeptNote[]>([]);
  const [kpis, setKpis] = useState<KpiOverride[]>([]);
  const [citesItems, setCitesItems] = useState<CitesItem[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ft, imp, map, sum, depts, notesData, kpisData, cites, packaging] = await Promise.all([
        fetchFileTypes(),
        fetchImports(),
        fetchMappings(),
        fetchSummary(),
        fetchDepartments(),
        fetchDeptNotes(),
        fetchKpiOverrides(),
        fetchCitesItems(),
        fetchPackagingItems(),
      ]);
      setFileTypes(ft);
      setImports(imp);
      setMappings(map);
      setSummary(sum as DeptSummaryRow[]);
      setDepartments(depts.length ? depts : DEMO_DEPTS);
      setNotes(notesData);
      setKpis(kpisData);
      setCitesItems(cites);
      setPackagingItems(packaging);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    fileTypes,
    imports,
    mappings,
    summary,
    departments,
    notes,
    kpis,
    citesItems,
    packagingItems,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

/** Rebuild the server-side summary then refresh the store. */
export async function persistAndRefresh(store: StoreState): Promise<void> {
  await rebuildSummary();
  await store.refresh();
}

/**
 * Returns demo department summary when no real imports exist,
 * real summary otherwise. Used as the single source of truth for the
 * Home BOH table across all dashboards.
 */
export function useViewSummary(store: StoreState): DeptSummaryRow[] {
  return useMemo(() => {
    if (store.summary.length) {
      // Merge seeded reference departments into the displayed set so the
      // Home table always shows the full 100–945 range even before imports.
      const seen = new Set(store.summary.map((r) => r.dept_id));
      const refRows = store.departments
        .filter((d) => d.sap_code && !seen.has(d.sap_code))
        .map((d) => ({
          dept_id: d.sap_code!,
          dept_name: d.name,
          stock_qty: 0, transit_qty: 0, inbound_qty: 0, outbound_qty: 0,
          newness_qty: 0, sales_qty: 0, sales_value: 0, adjust_qty: 0,
          adjust_value: 0, reservations_qty: 0, consignment_qty: 0,
          expeditions_qty: 0, fast_open: 0, mao_open: 0,
          risk: "ok" as const, hypothesis: "", action_taken: "",
          status: "open" as const, updated_at: new Date().toISOString(),
        }));
      return [...store.summary, ...refRows];
    }
    return store.departments.length
      ? demoDeptSummary(store.departments, DEMO_DEPT_NOTES)
      : demoDeptSummary(DEMO_DEPTS, DEMO_DEPT_NOTES);
  }, [store.summary, store.departments]);
}
