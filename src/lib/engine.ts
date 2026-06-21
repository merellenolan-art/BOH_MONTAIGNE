import type {
  CitesItem,
  Department,
  DeptNote,
  DeptSummaryRow,
  DestinationZone,
  FileType,
  ImportRecord,
  ImportStatus,
  KpiOverride,
  MappingRecord,
  NormalizedRow,
  PackagingItem,
  RiskLevel,
} from "../types";

/* ------------------------------------------------------------------ */
/* Header normalization                                                */
/* ------------------------------------------------------------------ */

export function normalizeHeader(h: string): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

export function normalizeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const key = normalizeHeader(h);
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? key : `${key}_${count}`;
  });
}

/* ------------------------------------------------------------------ */
/* Canonical field aliases (drives the intelligent mapping screen)     */
/* ------------------------------------------------------------------ */

const FIELD_ALIASES: Record<string, string[]> = {
  sku: ["sku", "material", "article", "barcode", "gtin", "matnr", "item_code", "product"],
  department: ["dept", "dept_id", "deptid", "department", "dept_code", "div", "division"],
  departmentName: ["dept_name", "deptname", "department_name", "departmentname", "dept_desc"],
  quantity: ["qty", "quantity", "stock", "on_hand", "onhand", "quantity_on_hand", "oh_qty"],
  value: ["amount", "sales_value", "salesvalue", "value", "val", "net_value", "amount_eur"],
  date: [
    "created_date", "released_date", "delivery_date", "date",
    "posting_date", "doc_date", "document_date", "created", "delivery",
  ],
  reference: ["reference", "ref", "doc", "document", "order", "order_id", "delivery", "ref_doc", "invoice"],
  status: ["status", "state", "stage", "status_code"],
  destination: ["destination", "dest", "ship_to", "shipto", "country", "zone", "region"],
  recipient: ["recipient", "receiver", "customer", "client", "consignee"],
  comment: ["comment", "comments", "note", "notes", "remark", "remarks"],
  barcode: ["barcode", "ean", "upc", "code_barre"],
  name: ["name", "label", "libelle", "designation"],
  description: ["description", "desc", "detail", "details"],
  location: ["location", "emplacement", "shelf", "bin", "rack"],
  priority: ["priority", "prio", "urgency"],
};

export function fieldMatchScore(normalizedHeader: string, field: string): number {
  const aliases = FIELD_ALIASES[field] ?? [];
  if (aliases.includes(normalizedHeader)) return 100;
  let best = 0;
  for (const alias of aliases) {
    if (normalizedHeader.includes(alias)) best = Math.max(best, 60);
    else if (alias.includes(normalizedHeader) && normalizedHeader.length > 2) best = Math.max(best, 40);
    const tokens = alias.split("_");
    const headerTokens = normalizedHeader.split("_");
    const overlap = tokens.filter((t) =>
      headerTokens.some((h) => h === t || (t.length > 3 && h.includes(t)))
    ).length;
    if (overlap > 0) best = Math.max(best, 20 + overlap * 10);
  }
  return best;
}

export function suggestMapping(
  headers: string[],
  fields: string[]
): Record<string, string> {
  const normalized = normalizeHeaders(headers);
  const result: Record<string, string> = {};
  for (const field of fields) {
    let bestHeader: string | undefined;
    let bestScore = 30;
    headers.forEach((raw, i) => {
      const score = fieldMatchScore(normalized[i], field);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = raw;
      }
    });
    if (bestHeader) result[field] = bestHeader;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* File-type detection                                                */
/* ------------------------------------------------------------------ */

const FILE_TYPE_SIGNALS: Record<string, string[]> = {
  stock: ["stock", "oh", "on hand", "onhand", "stock_oh", "stock online", "mb52"],
  transit: ["transit", "in transit", "in_transit", "vl06i"],
  inbound: ["inbound", "purchase order", "po", "goods receipt"],
  outbound: ["outbound", "goods issue", "outbound delivery", "gi"],
  sales: ["sales", "billing", "invoice", "revenue"],
  reservations: ["reservation", "reserv", "blocked stock"],
  consignment: ["consignment", "consgt", "consign"],
  adjust: ["adjust", "adjustment", "stock adjustment", "diff", "variance"],
  expeditions: ["expedition", "expédition", "shipment", "shipping", "expedier"],
  fast: ["fast", "fast order", "clienteling"],
  mao: ["mao", "e-commerce", "ecommerce", "web order", "online order"],
  cites: ["cites", "c.i.t.e.s", "species", "certificate"],
  packaging: ["packaging", "emballage", "pack", "wrapping"],
  terrain: ["terrain", "field", "inventaire terrain", "comptage"],
  fastshipment: ["fastshipment", "fast shipment", "expédition express"],
  packaging_lib: ["packaging", "bibliothèque", "library"],
  cites_extract: ["cites"],
  oracle_sales: ["oracle", "caisse", "pos"],
  sap_sales: ["sap", "ventes"],
};

export function detectFileType(
  fileName: string,
  headers: string[],
  fileTypes: FileType[]
): string | null {
  const text = (fileName + " " + headers.join(" ")).toLowerCase();
  const scores = new Map<string, number>();
  for (const ft of fileTypes) {
    const signals = FILE_TYPE_SIGNALS[ft.code] ?? [];
    let score = 0;
    for (const sig of signals) if (text.includes(sig)) score += 1;
    if (score > 0) scores.set(ft.code, score);
  }
  if (scores.size === 0) {
    const base = fileName.toLowerCase().replace(/\.[^.]+$/, "");
    for (const ft of fileTypes) {
      if (base.includes(ft.code) || base.includes("terrain")) scores.set(ft.code, 1);
    }
  }
  if (scores.size === 0) return null;
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ------------------------------------------------------------------ */
/* Import status                                                       */
/* ------------------------------------------------------------------ */

export function computeImportStatus(
  fileTypes: FileType[],
  detectedType: string | null,
  headers: string[],
  savedMapping: Record<string, string>
): ImportStatus {
  if (!detectedType) return "incompatible";
  const ft = fileTypes.find((f) => f.code === detectedType);
  if (!ft) return "incompatible";
  if (headers.length === 0) return "incompatible";
  const suggestions = suggestMapping(headers, ft.expected_fields);
  const merged = { ...suggestions, ...savedMapping };
  const hasSku = merged.sku || merged.reference;
  const hasQty = merged.quantity;
  const hasDept = merged.department || merged.departmentName;
  if (hasSku && hasQty && hasDept) return "recognized";
  if (hasSku || hasQty || hasDept) return "mapping_required";
  return "mapping_required";
}

/* ------------------------------------------------------------------ */
/* Numeric / date coercion                                             */
/* ------------------------------------------------------------------ */

export function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[€$\s,]/g, "").replace(/[^0-9.\-eE]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

export function toDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return epoch.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
}

export function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/* ------------------------------------------------------------------ */
/* Aggregation primitives — the JS equivalents of SUMIFS / COUNTIFS    */
/* ------------------------------------------------------------------ */

export function sumValues(rows: NormalizedRow[], field: keyof NormalizedRow): number {
  return rows.reduce((acc, r) => acc + (typeof r[field] === "number" ? (r[field] as number) : 0), 0);
}

export function sumQty(rows: NormalizedRow[]): number {
  return rows.reduce((acc, r) => acc + (r.quantity ?? 0), 0);
}

export function countRows<T>(rows: T[]): number {
  return rows.length;
}

export function groupByDepartment(rows: NormalizedRow[]): Map<string, NormalizedRow[]> {
  const map = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    if (!map.has(r.deptId)) map.set(r.deptId, []);
    map.get(r.deptId)!.push(r);
  }
  return map;
}

/** Group rows by destination zone (France / Europe / UK / Autre). */
export function groupByDestination(rows: NormalizedRow[]): Map<DestinationZone, NormalizedRow[]> {
  const map = new Map<DestinationZone, NormalizedRow[]>([
    ["France", []], ["Europe", []], ["UK", []], ["Autre", []],
  ]);
  for (const r of rows) {
    const zone = classifyDestination(r.destination ?? "");
    map.get(zone)!.push(r);
  }
  return map;
}

export function classifyDestination(dest: string): DestinationZone {
  const d = (dest ?? "").toLowerCase().trim();
  if (!d) return "Autre";
  if (["france", "fr", "paris", "montaigne"].some((k) => d.includes(k))) return "France";
  if (["uk", "united kingdom", "london", "londres"].some((k) => d.includes(k))) return "UK";
  if (["italy", "italie", "milano", "rome", "spain", "espagne", "germany", "allemagne", "europe"].some((k) => d.includes(k)))
    return "Europe";
  return "Autre";
}

/* ------------------------------------------------------------------ */
/* Aging                                                               */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 86400000;

export function calculateAging(dateStr: string, ref: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((ref.getTime() - d.getTime()) / MS_PER_DAY));
}

export function agingRisk(aging: number | null): RiskLevel {
  if (aging == null) return "ok";
  if (aging <= 2) return "ok";
  if (aging <= 6) return "attention";
  return "action";
}

/* ------------------------------------------------------------------ */
/* Row normalization from raw import + mapping                         */
/* ------------------------------------------------------------------ */

export function normalizeRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  fallbackDeptId = "UNKNOWN"
): NormalizedRow[] {
  const src = (field: string) => mapping[field];
  return rows.map((raw) => {
    const deptRaw = toStr(raw[src("department") as string] ?? raw["DEPT"] ?? "");
    const deptNameRaw = toStr(raw[src("departmentName") as string] ?? raw["DEPT_NAME"] ?? "");
    const deptId = deptRaw || fallbackDeptId;
    return {
      deptId,
      deptName: deptNameRaw || deptId,
      sku: toStr(raw[src("sku") as string]) || undefined,
      reference: toStr(raw[src("reference") as string]) || undefined,
      quantity: toNumber(raw[src("quantity") as string]),
      value: toNumber(raw[src("value") as string]),
      date: toDate(raw[src("date") as string]),
      status: toStr(raw[src("status") as string]) || undefined,
      destination: toStr(raw[src("destination") as string]) || undefined,
      recipient: toStr(raw[src("recipient") as string]) || undefined,
      comment: toStr(raw[src("comment") as string]) || undefined,
      priority: toStr(raw[src("priority") as string]) || undefined,
      barcode: toStr(raw[src("barcode") as string]) || undefined,
      name: toStr(raw[src("name") as string]) || undefined,
      description: toStr(raw[src("description") as string]) || undefined,
      location: toStr(raw[src("location") as string]) || undefined,
    };
  });
}

/* ------------------------------------------------------------------ */
/* buildDepartmentSummary — pivot feeding every dashboard             */
/* ------------------------------------------------------------------ */

export interface BuildSummaryInput {
  imports: ImportRecord[];
  mappings: MappingRecord[];
  fileTypes: FileType[];
  departments?: Department[];
  notes?: DeptNote[];
  existing: DeptSummaryRow[];
}

const mappingMap = (mappings: MappingRecord[], fileType: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of mappings) {
    if (m.file_type === fileType) out[m.canonical_field] = m.source_column;
  }
  return out;
};

export function buildDepartmentSummary(input: BuildSummaryInput): DeptSummaryRow[] {
  const noteMap = new Map((input.notes ?? []).map((n) => [n.dept_code, n]));
  const lookup = new Map(input.existing.map((r) => [r.dept_id, r]));
  const deptRef = new Map((input.departments ?? []).map((d) => [d.sap_code ?? d.dept_code, d]));

  const byType = new Map<string, NormalizedRow[]>();
  for (const imp of input.imports) {
    if (!imp.file_type || imp.rows.length === 0) continue;
    const mapping = mappingMap(input.mappings, imp.file_type);
    const norm = normalizeRows(imp.rows, mapping);
    if (!byType.has(imp.file_type)) byType.set(imp.file_type, []);
    byType.get(imp.file_type)!.push(...norm);
  }

  const departments = new Set<string>();
  byType.forEach((rows) => rows.forEach((r) => departments.add(r.deptId)));
  // Also include seeded department reference rows even when no import
  // references them, so the Home table shows the full 100–945 range.
  (input.departments ?? []).forEach((d) => {
    if (d.sap_code) departments.add(d.sap_code);
  });

  const result: DeptSummaryRow[] = [];
  for (const deptId of [...departments].sort()) {
    const prev = lookup.get(deptId);
    const ref = deptRef.get(deptId);
    const note = noteMap.get(deptId) ?? noteMap.get(ref?.dept_code ?? "");

    const rowsOf = (t: string): NormalizedRow[] => byType.get(t) ?? [];
    const deptName =
      rowsOf("stock").concat(rowsOf("sales"), rowsOf("terrain"), rowsOf("transit"))
        .find((r) => r.deptName && r.deptName !== r.deptId)?.deptName ??
      ref?.name ?? prev?.dept_name ?? deptId;

    const stockQty = sumQty(rowsOf("stock"));
    const transitQty = sumQty(rowsOf("transit"));
    const inboundQty = sumQty(rowsOf("inbound"));
    const outboundQty = sumQty(rowsOf("outbound"));
    const salesQty = sumQty(rowsOf("sales"));
    const salesValue = sumValues(rowsOf("sales"), "value");
    const adjustQty = sumQty(rowsOf("adjust"));
    const adjustValue = sumValues(rowsOf("adjust"), "value");
    const reservationsQty = sumQty(rowsOf("reservations"));
    const consignmentQty = sumQty(rowsOf("consignment"));
    const expeditionsQty = sumQty(rowsOf("expeditions"));
    const newnessQty = inboundQty; // heuristic: inbound still open = newness

    const isOpen = (r: NormalizedRow) => {
      const s = (r.status ?? "").toLowerCase();
      return !(s.includes("closed") || s.includes("done") || s.includes("completed") || s.includes("delivered"));
    };
    const fastOpen = rowsOf("fast").filter(isOpen).length;
    const maoOpen = rowsOf("mao").filter(isOpen).length;

    const autoRisk = deriveRisk({ stockQty, salesQty, adjustQty, expeditionsQty, fastOpen, maoOpen });
    const risk: RiskLevel = note?.risk ?? autoRisk;

    result.push({
      dept_id: deptId,
      dept_name: deptName,
      stock_qty: stockQty,
      transit_qty: transitQty,
      inbound_qty: inboundQty,
      outbound_qty: outboundQty,
      newness_qty: newnessQty,
      sales_qty: salesQty,
      sales_value: salesValue,
      adjust_qty: adjustQty,
      adjust_value: adjustValue,
      reservations_qty: reservationsQty,
      consignment_qty: consignmentQty,
      expeditions_qty: expeditionsQty,
      fast_open: fastOpen,
      mao_open: maoOpen,
      risk,
      hypothesis: prev?.hypothesis ?? "",
      action_taken: note?.comment ?? prev?.action_taken ?? "",
      status: prev?.status ?? "open",
      updated_at: new Date().toISOString(),
    });
  }
  return result;
}

function deriveRisk(p: {
  stockQty: number;
  salesQty: number;
  adjustQty: number;
  expeditionsQty: number;
  fastOpen: number;
  maoOpen: number;
}): RiskLevel {
  let score = 0;
  if (p.adjustQty !== 0) score += 2;
  if (Math.abs(p.adjustQty) > Math.abs(p.salesQty) * 0.05 && p.salesQty > 0) score += 1;
  if (p.fastOpen > 5) score += 1;
  if (p.maoOpen > 5) score += 1;
  if (p.expeditionsQty > 10) score += 1;
  if (p.stockQty === 0) score += 2;
  if (score >= 4) return "action";
  if (score >= 2) return "attention";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Export helpers                                                       */
/* ------------------------------------------------------------------ */

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV(fileName: string, rows: Record<string, unknown>[]) {
  downloadBlob(toCSV(rows), fileName, "text/csv;charset=utf-8;");
}

export function buildWhatsAppSummary(
  title: string,
  summary: { label: string; value: string | number }[],
  lines: string[] = []
): string {
  const header = `*${title} — ${new Date().toLocaleDateString("fr-FR")}*`;
  const body = summary.map((s) => `• ${s.label}: ${s.value}`).join("\n");
  const footer = lines.length ? `\n${lines.join("\n")}` : "";
  return `${header}\n${body}${footer}`;
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } finally { ta.remove(); }
}

export async function exportExcel(fileName: string, rows: Record<string, unknown>[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(out, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});

export function fmtNum(n: number): string { return nf.format(n); }
export function fmtEur(n: number): string { return eur.format(n); }
export function fmtPct(n: number): string { return `${nf.format(n)} %`; }

/* ------------------------------------------------------------------ */
/* Demo data generators — anonymized placeholders shown until imports  */
/* Replace nothing real; values are obviously synthetic (round numbers).*/
/* ------------------------------------------------------------------ */

// Deterministic PRNG so demo data is stable across reloads within a session.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function demoDepartments(): Department[] {
  // Matches the seeded 100–945 range. Names mirror the migration.
  const rows: Array<[string, string, string, string]> = [
    ["100", "K112100", "Femme Prêt-à-porter", "Femme"],
    ["110", "K112110", "Femme Tailleur", "Femme"],
    ["120", "K112120", "Femme Fourrure", "Femme"],
    ["130", "K112130", "Femme Soie", "Femme"],
    ["140", "K112140", "Femme Maille", "Femme"],
    ["150", "K112150", "Femme Shoes", "Femme"],
    ["160", "K112160", "Femme Sneakers", "Femme"],
    ["170", "K112170", "Femme Small Leather Goods", "Femme"],
    ["180", "K112180", "Femme Handbags", "Femme"],
    ["190", "K112190", "Femme Travel", "Femme"],
    ["200", "K112200", "Femme Jewellery", "Femme"],
    ["210", "K112210", "Femme Watches", "Femme"],
    ["220", "K112220", "Femme Fragrances", "Femme"],
    ["230", "K112230", "Femme Cosmetics", "Femme"],
    ["240", "K112240", "Femme Eyewear", "Femme"],
    ["250", "K112250", "Femme Textile accessories", "Femme"],
    ["300", "K112300", "Homme Prêt-à-porter", "Homme"],
    ["310", "K112310", "Homme Tailleur", "Homme"],
    ["320", "K112320", "Homme Outerwear", "Homme"],
    ["330", "K112330", "Homme Shoes", "Homme"],
    ["340", "K112340", "Homme Sneakers", "Homme"],
    ["350", "K112350", "Homme Small Leather Goods", "Homme"],
    ["360", "K112360", "Homme Handbags", "Homme"],
    ["370", "K112370", "Homme Travel", "Homme"],
    ["380", "K112380", "Homme Jewellery", "Homme"],
    ["390", "K112390", "Homme Watches", "Homme"],
    ["400", "K112400", "Homme Fragrances", "Homme"],
    ["410", "K112410", "Homme Textile accessories", "Homme"],
    ["500", "K112500", "Bagages", "Maison"],
    ["510", "K112510", "Soft Luggage", "Maison"],
    ["520", "K112520", "Décoratif Maison", "Maison"],
    ["600", "K112600", "Gift Collection", "Maison"],
    ["700", "K112700", "Kids & Baby", "Maison"],
    ["800", "K112800", "Art de la Table", "Maison"],
    ["850", "K112850", "Stations & Fragrances Décor", "Maison"],
    ["900", "K112900", "Décoration", "Maison"],
    ["910", "K112910", "Livres & Catalogues", "Maison"],
    ["920", "K112920", "Communication", "Maison"],
    ["930", "K112930", "Visual Merchandising", "Maison"],
    ["940", "K112940", "Packaging Boutique", "Maison"],
    ["945", "K112945", "Autres / Divers", "Maison"],
  ];
  return rows.map(([dept_code, sap_code, name, division]) => ({ dept_code, sap_code, name, division }));
}

export function demoDeptSummary(depts: Department[], notes: DeptNote[]): DeptSummaryRow[] {
  const rnd = rng(42);
  const noteMap = new Map(notes.map((n) => [n.dept_code, n] as const));
  return depts.map((d, i) => {
    const rnd2 = rng(1000 + i * 7);
    const stockQty = Math.round(40 + rnd2() * 480);
    const transitQty = Math.round(rnd2() * 60);
    const inboundQty = Math.round(rnd2() * 25);
    const outboundQty = Math.round(rnd2() * 20);
    const salesQty = Math.round(rnd2() * 50);
    const salesValue = Math.round(salesQty * (150 + rnd2() * 1850));
    const adjustQty = rnd2() > 0.7 ? Math.round((rnd2() - 0.5) * 12) : 0;
    const adjustValue = Math.round(adjustQty * (200 + rnd2() * 800));
    const reservationsQty = Math.round(rnd2() * 8);
    const consignmentQty = Math.round(rnd2() * 6);
    const expeditionsQty = Math.round(rnd2() * 15);
    const fastOpen = Math.round(rnd2() * 8);
    const maoOpen = Math.round(rnd2() * 6);
    const autoRisk: RiskLevel =
      adjustQty !== 0 || fastOpen > 5 || stockQty < 20 ? "attention" : "ok";
    const note = noteMap.get(d.dept_code);
    void rnd;
    return {
      dept_id: d.sap_code ?? d.dept_code,
      dept_name: d.name,
      stock_qty: stockQty,
      transit_qty: transitQty,
      inbound_qty: inboundQty,
      outbound_qty: outboundQty,
      newness_qty: inboundQty,
      sales_qty: salesQty,
      sales_value: salesValue,
      adjust_qty: adjustQty,
      adjust_value: adjustValue,
      reservations_qty: reservationsQty,
      consignment_qty: consignmentQty,
      expeditions_qty: expeditionsQty,
      fast_open: fastOpen,
      mao_open: maoOpen,
      risk: note?.risk ?? autoRisk,
      hypothesis: note?.comment ?? "",
      action_taken: note?.comment ?? "",
      status: "open",
      updated_at: new Date().toISOString(),
    };
  });
}

export interface DemoTransitRow {
  invoice: string;
  destination: string;
  zone: DestinationZone;
  date: string;
  qty: number;
  sku: string;
  aging: number;
  risk: RiskLevel;
}

export function demoTransit(): DemoTransitRow[] {
  const rnd = rng(7);
  const zones: DestinationZone[] = ["France", "Europe", "UK", "Autre"];
  const dests: Record<DestinationZone, string[]> = {
    France: ["Paris", "Lyon", "Bordeaux"],
    Europe: ["Milano", "Madrid", "Roma"],
    UK: ["London"],
    Autre: ["Tokyo", "New York", "Hong Kong"],
  };
  const rows: DemoTransitRow[] = [];
  for (let i = 0; i < 24; i++) {
    const zone = zones[Math.floor(rnd() * zones.length)];
    const dest = dests[zone][Math.floor(rnd() * dests[zone].length)];
    const aging = Math.floor(rnd() * 14);
    rows.push({
      invoice: `INV-${String(10240 + i).padStart(6, "0")}`,
      destination: dest,
      zone,
      date: new Date(Date.now() - aging * 86400000).toISOString().slice(0, 10),
      qty: Math.round(1 + rnd() * 18),
      sku: `SKU-${String(50000 + i * 13).padStart(6, "0")}`,
      aging,
      risk: aging > 7 ? "action" : aging > 2 ? "attention" : "ok",
    });
  }
  return rows.sort((a, b) => b.aging - a.aging);
}

export interface DemoNegativeStockRow {
  sku: string;
  qc: string;
  dept: string;
  qty: number;
  risk: RiskLevel;
}

export function demoNegativeStock(): DemoNegativeStockRow[] {
  const rnd = rng(13);
  const depts = ["100", "180", "300", "350", "940"];
  return Array.from({ length: 8 }).map((_, i) => {
    const qty = -Math.round(1 + rnd() * 6);
    return {
      sku: `SKU-${String(61000 + i * 9).padStart(6, "0")}`,
      qc: `QC-${Math.floor(rnd() * 99)}`,
      dept: depts[Math.floor(rnd() * depts.length)],
      qty,
      risk: "action",
    };
  });
}

export interface DemoPackagingItem extends PackagingItem {}

export function demoPackaging(): DemoPackagingItem[] {
  const photos = [
    "https://images.pexels.com/photos/6463340/pexels-photo-6463340.jpeg",
    "https://images.pexels.com/photos/6463249/pexels-photo-6463249.jpeg",
    "https://images.pexels.com/photos/4464820/pexels-photo-4464820.jpeg",
    "https://images.pexels.com/photos/6210762/pexels-photo-6210762.jpeg",
  ];
  const data = [
    ["PK-001", "3401234500011", "Box cadeau GG", "Boîte carton motif GG", "Emballage cadeau", "Bordeaux", 220, 0, 100, true],
    ["PK-002", "3401234500022", "Pochette velours", "Pochette souple velours noir", "Petits articles", "Noir", 140, 30, 80, true],
    ["PK-003", "3401234500033", "Ruban satin", "Ruban satin signé, 2 m", "Finition cadeau", "Bordeaux", 65, 0, 60, false],
    ["PK-004", "3401234500044", "Carton expédition M", "Carton rigide moyen", "Logistique", "Kraft", 18, 50, 40, false],
    ["PK-005", "3401234500055", "Papier de soie", "Papier de soie logo, 50 feuilles", "Protection cadeau", "Bordeaux", 8, 10, 30, false],
    ["PK-006", "3401234500066", "Étui bijou", "Écrin bijou rigide", "Joaillerie", "Noir", 35, 0, 25, true],
  ] as const;
  return data.map(([sku, barcode, name, description, usage, tsl, on_hand, in_transit, threshold, sensitive], i) => ({
    id: `demo-pk-${i}`,
    sku: sku as string,
    barcode: barcode as string,
    name: name as string,
    description: description as string,
    usage: usage as string,
    tsl: tsl as string,
    on_hand: on_hand as number,
    in_transit: in_transit as number,
    reorder_threshold: threshold as number,
    sensitive: sensitive as boolean,
    image_url: photos[i % photos.length],
    updated_at: new Date().toISOString(),
  }));
}

export interface DemoCitesItem extends CitesItem {}

export function demoCites(): DemoCitesItem[] {
  const data = [
    ["SKU-70100", "Sac Exotic Python", 2, "Vault A-3", 4200, "complete", true, true, true, true],
    ["SKU-70110", "Ceinture croco", 1, "Vault A-3", 1800, "in_progress", true, true, false, true],
    ["SKU-70120", "Portefeuille lézard", 3, "Vault A-4", 1450, "todo", false, true, false, true],
    ["SKU-70130", "Sandales python", 1, "Vault A-3", 2100, "reexport_required", true, false, false, true],
    ["SKU-70140", "Bracelet croco", 2, "Vault A-4", 2600, "todo", false, false, false, false],
  ] as const;
  const statuses = ["todo", "in_progress", "complete", "reexport_required"] as const;
  return data.map(([sku, description, quantity, location, value, status, c, ci, ce, ph], i) => ({
    id: `demo-cites-${i}`,
    sku: sku as string,
    description: description as string,
    quantity: quantity as number,
    location: location as string,
    value: value as number,
    dossier_status: statuses.indexOf(status as typeof statuses[number]) >= 0
      ? (status as "todo" | "in_progress" | "complete" | "reexport_required")
      : "todo",
    docs_certificate: c as boolean,
    docs_invoice: ci as boolean,
    docs_export: ce as boolean,
    docs_photo: ph as boolean,
    notes: "",
    updated_at: new Date().toISOString(),
  }));
}

export interface DemoExpeditionRow {
  reference: string;
  destination: string;
  zone: DestinationZone;
  recipient: string;
  status: string;
  blocked: boolean;
  value: number;
  aging: number;
  risk: RiskLevel;
}

export function demoExpeditions(): DemoExpeditionRow[] {
  const rnd = rng(91);
  const zones: DestinationZone[] = ["France", "Europe", "UK", "Autre"];
  const dests: Record<DestinationZone, string[]> = {
    France: ["Paris 8e", "Lyon", "Nice"],
    Europe: ["Roma", "Madrid", "Wien"],
    UK: ["London", "Manchester"],
    Autre: ["Tokyo", "New York"],
  };
  const names = ["M. Dupont", "Mme Martin", "M. Bianchi", "Mme Garcia", "M. Schmidt", "Mme Tanaka"];
  const statuses = ["Préparée", "Livreur", "Livrée", "Bloquée"];
  return Array.from({ length: 14 }).map((_, i) => {
    const zone = zones[Math.floor(rnd() * zones.length)];
    const dest = dests[zone][Math.floor(rnd() * dests[zone].length)];
    const aging = Math.floor(rnd() * 10);
    const status = statuses[Math.floor(rnd() * statuses.length)];
    const blocked = status === "Bloquée";
    return {
      reference: `EXP-${String(45000 + i * 7).padStart(6, "0")}`,
      destination: dest,
      zone,
      recipient: names[Math.floor(rnd() * names.length)],
      status,
      blocked,
      value: Math.round(400 + rnd() * 4600),
      aging,
      risk: blocked || aging > 6 ? "action" : aging > 2 ? "attention" : "ok",
    };
  });
}

export interface DemoMaoRow {
  reference: string;
  sku: string;
  qty: number;
  date: string;
  aging: number;
  status: string;
  priority: "haute" | "moyenne" | "basse";
  risk: RiskLevel;
}

export function demoMao(): DemoMaoRow[] {
  const rnd = rng(202);
  const priorités = ["haute", "moyenne", "basse"] as const;
  const statuses = ["À préparer", "En préparation", "Prête", "En attente client"];
  return Array.from({ length: 18 }).map((_, i) => {
    const aging = Math.floor(rnd() * 10);
    const status = statuses[Math.floor(rnd() * statuses.length)];
    return {
      reference: `MAO-${String(78000 + i * 5).padStart(6, "0")}`,
      sku: `SKU-${String(62000 + i * 11).padStart(6, "0")}`,
      qty: Math.round(1 + rnd() * 4),
      date: new Date(Date.now() - aging * 86400000).toISOString().slice(0, 10),
      aging,
      status,
      priority: aging > 4 ? "haute" : priorités[Math.floor(rnd() * priorités.length)],
      risk: aging > 5 ? "action" : aging > 2 ? "attention" : "ok",
    };
  });
}

export interface DemoOracleRow {
  sku: string;
  oracleQty: number;
  sapQty: number;
  oracleValue: number;
  sapValue: number;
  ecartQty: number;
  ecartValue: number;
  conforme: boolean;
  risk: RiskLevel;
}

export function demoOracleSap(): DemoOracleRow[] {
  const rnd = rng(303);
  return Array.from({ length: 18 }).map((_, i) => {
    const oracleQty = Math.round(2 + rnd() * 30);
    const drift = rnd() > 0.7 ? Math.round((rnd() - 0.5) * 8) : 0;
    const sapQty = oracleQty + drift;
    const price = Math.round(150 + rnd() * 1850);
    const oracleValue = oracleQty * price;
    const sapValue = sapQty * price;
    const ecartQty = oracleQty - sapQty;
    const ecartValue = oracleValue - sapValue;
    const conforme = Math.abs(ecartQty) === 0 && Math.abs(ecartValue) === 0;
    return {
      sku: `SKU-${String(70000 + i * 17).padStart(6, "0")}`,
      oracleQty, sapQty, oracleValue, sapValue,
      ecartQty, ecartValue, conforme,
      risk: conforme ? "ok" : Math.abs(ecartValue) > 1000 ? "action" : "attention",
    };
  });
}

export interface DemoEveningFlow {
  type: "Réception" | "Expédition";
  reference: string;
  zone: DestinationZone;
  destination: string;
  qty: number;
  value: number;
  time: string;
}

export function demoEveningFlows(): DemoEveningFlow[] {
  const rnd = rng(404);
  const zones: DestinationZone[] = ["France", "Europe", "UK", "Autre"];
  const dests: Record<DestinationZone, string[]> = {
    France: ["Paris 8e", "Neuilly"],
    Europe: ["Milano", "Madrid"],
    UK: ["London"],
    Autre: ["Tokyo", "New York"],
  };
  const flows: DemoEveningFlow[] = [];
  for (let i = 0; i < 8; i++) {
    const zone = zones[Math.floor(rnd() * zones.length)];
    flows.push({
      type: "Réception",
      reference: `GR-${String(32000 + i).padStart(6, "0")}`,
      zone,
      destination: dests[zone][Math.floor(rnd() * dests[zone].length)],
      qty: Math.round(2 + rnd() * 20),
      value: Math.round(300 + rnd() * 4200),
      time: `${8 + Math.floor(rnd() * 4)}h${rnd() > 0.5 ? "30" : "00"}`,
    });
  }
  for (let i = 0; i < 8; i++) {
    const zone = zones[Math.floor(rnd() * zones.length)];
    flows.push({
      type: "Expédition",
      reference: `GI-${String(41000 + i).padStart(6, "0")}`,
      zone,
      destination: dests[zone][Math.floor(rnd() * dests[zone].length)],
      qty: Math.round(1 + rnd() * 10),
      value: Math.round(200 + rnd() * 3800),
      time: `${13 + Math.floor(rnd() * 5)}h${rnd() > 0.5 ? "30" : "00"}`,
    });
  }
  return flows;
}

export function demoKpis(): KpiOverride[] {
  return [
    { key: "annual_sales", label: "Ventes annuelles", value_numeric: 0, unit: "EUR", updated_at: "", updated_by: "" },
    { key: "ytd_sales", label: "Ventes YTD", value_numeric: 0, unit: "EUR", updated_at: "", updated_by: "" },
    { key: "completion_rate", label: "Taux de complétion", value_numeric: 0, unit: "%", updated_at: "", updated_by: "" },
    { key: "conversion_rate", label: "Taux de conversion", value_numeric: 0, unit: "%", updated_at: "", updated_by: "" },
    { key: "saturation_rate", label: "Taux de saturation", value_numeric: 0, unit: "%", updated_at: "", updated_by: "" },
    { key: "shrinkage", label: "Shrinkage", value_numeric: 0, unit: "%", updated_at: "", updated_by: "" },
  ];
}
