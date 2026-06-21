import * as XLSX from "xlsx";
import { supabase, DB } from "./supabase";
import type { FileType, ImportRecord, MappingRecord } from "../types";
import {
  computeImportStatus,
  detectFileType,
  normalizeHeaders,
  suggestMapping,
} from "./engine";

export interface ParsedFile {
  fileName: string;
  sheetNames: string[];
  headers: Record<string, string[]>;
  rows: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/* File parsing with SheetJS                                           */
/* ------------------------------------------------------------------ */

export async function parseWorkbook(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, dense: true });
  const sheetNames = wb.SheetNames;

  const headers: Record<string, string[]> = {};
  const rows: Record<string, unknown>[] = [];

  const primary = sheetNames[0];
  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: true,
    });
    const detectedHeaders =
      json.length > 0 ? Object.keys(json[0]) : XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] ?? [];
    headers[sheetName] = detectedHeaders as string[];
    if (sheetName === primary || rows.length === 0) {
      rows.push(...json);
    }
  }

  return {
    fileName: file.name,
    sheetNames,
    headers,
    rows,
  };
}

/* ------------------------------------------------------------------ */
/* CRUD against Supabase                                               */
/* ------------------------------------------------------------------ */

export async function fetchFileTypes(): Promise<FileType[]> {
  const { data, error } = await supabase
    .from(DB.fileTypes)
    .select("code, name, category, expected_fields")
    .order("name");
  if (error) throw error;
  return (data ?? []) as FileType[];
}

export async function fetchImports(): Promise<ImportRecord[]> {
  const { data, error } = await supabase
    .from(DB.imports)
    .select("*")
    .order("imported_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImportRecord[];
}

export async function fetchMappings(): Promise<MappingRecord[]> {
  const { data, error } = await supabase
    .from(DB.mappings)
    .select("*")
    .order("file_type, canonical_field");
  if (error) throw error;
  return (data ?? []) as MappingRecord[];
}

export async function fetchSummary() {
  const { data, error } = await supabase
    .from(DB.summary)
    .select("*")
    .order("dept_id");
  if (error) throw error;
  return data ?? [];
}

export interface SaveImportInput {
  fileName: string;
  sheetNames: string[];
  headers: Record<string, string[]>;
  rows: Record<string, unknown>[];
  fileTypes: FileType[];
  existingMapping: MappingRecord[];
}

/**
 * Parse -> detect -> compute status -> persist import + (optionally) auto-saved mapping.
 * Returns the saved import row.
 */
export async function saveImport(
  input: SaveImportInput
): Promise<{ record: ImportRecord; detectedType: string | null }> {
  const flatHeaders = Object.values(input.headers).flat();
  const detectedType = detectFileType(input.fileName, flatHeaders, input.fileTypes);

  const savedMapping = input.existingMapping
    .filter((m) => m.file_type === detectedType)
    .reduce<Record<string, string>>((acc, m) => {
      acc[m.canonical_field] = m.source_column;
      return acc;
    }, {}) as Record<string, string>;

  const status = computeImportStatus(
    input.fileTypes,
    detectedType,
    flatHeaders,
    savedMapping
  );

  const payload = {
    file_type: detectedType,
    file_name: input.fileName,
    sheet_names: input.sheetNames,
    headers: input.headers,
    row_count: input.rows.length,
    status,
    rows: input.rows,
  };

  const { data, error } = await supabase
    .from(DB.imports)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;

  // Auto-save suggested mapping for newly recognized imports that have none yet.
  if (detectedType && status !== "incompatible") {
    const ft = input.fileTypes.find((f) => f.code === detectedType);
    if (ft) {
      const suggestions = suggestMapping(
        Object.values(input.headers)[0] ?? [],
        ft.expected_fields
      );
      const toInsert = Object.entries(suggestions)
        .filter(([field]) => !savedMapping[field])
        .map(([field, col]) => ({
          file_type: detectedType,
          canonical_field: field,
          source_column: col,
        }));
      if (toInsert.length) {
        await supabase.from(DB.mappings).upsert(toInsert, { onConflict: "file_type,canonical_field" });
      }
    }
  }

  return {
    record: data as unknown as ImportRecord,
    detectedType,
  };
}

export async function deleteImport(id: string): Promise<void> {
  const { error } = await supabase.from(DB.imports).delete().eq("id", id);
  if (error) throw error;
}

export async function saveMapping(
  fileType: string,
  canonicalField: string,
  sourceColumn: string
): Promise<void> {
  const { error } = await supabase
    .from(DB.mappings)
    .upsert(
      { file_type: fileType, canonical_field: canonicalField, source_column: sourceColumn },
      { onConflict: "file_type,canonical_field" }
    );
  if (error) throw error;
}

export async function replaceSummaryRows(
  rows: Record<string, unknown>[]
): Promise<void> {
  // Simple replace-all: delete then insert. Safe in single-tenant tool.
  const { error: dErr } = await supabase.from(DB.summary).delete().neq("dept_id", "__never__");
  if (dErr) throw dErr;
  if (rows.length === 0) return;

  const cleaned = rows.map((r) => ({
    dept_id: String(r.dept_id ?? ""),
    dept_name: String(r.dept_name ?? ""),
    stock_qty: Number(r.stock_qty ?? 0),
    transit_qty: Number(r.transit_qty ?? 0),
    inbound_qty: Number(r.inbound_qty ?? 0),
    outbound_qty: Number(r.outbound_qty ?? 0),
    newness_qty: Number(r.newness_qty ?? 0),
    sales_qty: Number(r.sales_qty ?? 0),
    sales_value: Number(r.sales_value ?? 0),
    adjust_qty: Number(r.adjust_qty ?? 0),
    adjust_value: Number(r.adjust_value ?? 0),
    reservations_qty: Number(r.reservations_qty ?? 0),
    consignment_qty: Number(r.consignment_qty ?? 0),
    expeditions_qty: Number(r.expeditions_qty ?? 0),
    fast_open: Number(r.fast_open ?? 0),
    mao_open: Number(r.mao_open ?? 0),
    risk: String(r.risk ?? "ok"),
    hypothesis: String(r.hypothesis ?? ""),
    action_taken: String(r.action_taken ?? ""),
    status: String(r.status ?? "open"),
  }));

  const CHUNK = 500;
  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const { error: iErr } = await supabase
      .from(DB.summary)
      .insert(cleaned.slice(i, i + CHUNK));
    if (iErr) throw iErr;
  }
}

export async function updateDeptNote(
  deptId: string,
  patch: { hypothesis?: string; action_taken?: string; status?: string }
): Promise<void> {
  const { error } = await supabase
    .from(DB.summary)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("dept_id", deptId);
  if (error) throw error;
}

/** Rebuild the department summary from all imports+mappings and save it. */
export async function rebuildSummary(): Promise<void> {
  const [fileTypes, imports, mappings, existingStr, departments, notes] = await Promise.all([
    fetchFileTypes(),
    fetchImports(),
    fetchMappings(),
    fetchSummaryRaw(),
    fetchDepartments(),
    fetchDeptNotes(),
  ]);
  const { buildDepartmentSummary } = await import("./engine");
  const existing = buildDepartmentSummary({
    imports,
    mappings,
    fileTypes,
    departments,
    notes,
    existing: existingStr.map((e) => ({
      dept_id: String(e.dept_id ?? ""),
      dept_name: String(e.dept_name ?? ""),
      stock_qty: Number(e.stock_qty ?? 0),
      transit_qty: Number(e.transit_qty ?? 0),
      inbound_qty: Number(e.inbound_qty ?? 0),
      outbound_qty: Number(e.outbound_qty ?? 0),
      newness_qty: Number(e.newness_qty ?? 0),
      sales_qty: Number(e.sales_qty ?? 0),
      sales_value: Number(e.sales_value ?? 0),
      adjust_qty: Number(e.adjust_qty ?? 0),
      adjust_value: Number(e.adjust_value ?? 0),
      reservations_qty: Number(e.reservations_qty ?? 0),
      consignment_qty: Number(e.consignment_qty ?? 0),
      expeditions_qty: Number(e.expeditions_qty ?? 0),
      fast_open: Number(e.fast_open ?? 0),
      mao_open: Number(e.mao_open ?? 0),
      risk: String(e.risk ?? "ok") as "ok" | "attention" | "action",
      hypothesis: String(e.hypothesis ?? ""),
      action_taken: String(e.action_taken ?? ""),
      status: String(e.status ?? "open") as "open" | "in_progress" | "closed",
      updated_at: String(e.updated_at ?? new Date().toISOString()),
    })),
  });
  await replaceSummaryRows(existing as unknown as Record<string, unknown>[]);
}

async function fetchSummaryRaw() {
  const { data, error } = await supabase
    .from(DB.summary)
    .select("*")
    .order("dept_id");
  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

/** Force a header recompute after SheetJS parse — exported for tests reuse. */
export function headerKeys(headers: string[]): string[] {
  return normalizeHeaders(headers);
}

/* ------------------------------------------------------------------ */
/* New entities: departments, KPI overrides, dept notes, CITES, packaging */
/* ------------------------------------------------------------------ */

import type {
  CitesItem,
  Department,
  DeptNote,
  KpiOverride,
  PackagingItem,
  RiskLevel,
} from "../types";

export async function fetchDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from("boh_departments")
    .select("dept_code, sap_code, name, division")
    .order("dept_code");
  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function fetchSummaryRows(): Promise<Record<string, unknown>[]> {
  return fetchSummaryRaw();
}

export async function fetchDeptNotes(): Promise<DeptNote[]> {
  const { data, error } = await supabase
    .from("boh_dept_notes")
    .select("dept_code, risk, comment, updated_at")
    .order("dept_code");
  if (error) throw error;
  return ((data ?? []) as DeptNote[]).map((n) => ({
    dept_code: n.dept_code,
    risk: String(n.risk) as RiskLevel,
    comment: n.comment,
    updated_at: n.updated_at,
  }));
}

export async function upsertDeptNote(
  deptCode: string,
  patch: { risk?: RiskLevel; comment?: string }
): Promise<void> {
  const { error } = await supabase
    .from("boh_dept_notes")
    .upsert(
      { dept_code: deptCode, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "dept_code" }
    );
  if (error) throw error;
}

export async function fetchKpiOverrides(): Promise<KpiOverride[]> {
  const { data, error } = await supabase
    .from("boh_kpi_overrides")
    .select("key, label, value_numeric, unit, updated_at, updated_by")
    .order("key");
  if (error) throw error;
  return (data ?? []) as KpiOverride[];
}

export async function upsertKpi(key: string, value: number): Promise<void> {
  const { error } = await supabase
    .from("boh_kpi_overrides")
    .update({ value_numeric: value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}

export async function fetchCitesItems(): Promise<CitesItem[]> {
  const { data, error } = await supabase
    .from("boh_cites_items")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CitesItem[];
}

export async function upsertCitesItem(
  id: string,
  patch: Partial<CitesItem>
): Promise<void> {
  const { error } = await supabase
    .from("boh_cites_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchPackagingItems(): Promise<PackagingItem[]> {
  const { data, error } = await supabase
    .from("boh_packaging_items")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PackagingItem[];
}

export interface RawImportRows {
  fileType: string | null;
  rows: Record<string, unknown>[];
}

