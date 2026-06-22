// Canonical field identifiers shared by every file type.
export type CanonicalField =
  | "sku"
  | "department"
  | "departmentName"
  | "quantity"
  | "value"
  | "date"
  | "reference"
  | "status"
  | "destination"
  | "recipient"
  | "comment"
  | "barcode"
  | "name"
  | "description"
  | "location"
  | "priority";

export type FileCategory =
  | "stock"
  | "movement"
  | "sales"
  | "logistics"
  | "regulation";

export interface FileType {
  code: string;
  name: string;
  category: FileCategory;
  expected_fields: CanonicalField[];
}

export type ImportStatus = "recognized" | "mapping_required" | "incompatible";

export interface RejectReason {
  reason: string;
  count: number;
}

export interface ImportRecord {
  id: string;
  file_type: string | null;
  file_name: string;
  sheet_names: string[];
  headers: Record<string, string[]>;
  row_count: number;
  status: ImportStatus;
  rows: Record<string, unknown>[];
  accepted_count?: number;
  rejected_count?: number;
  rejected_reasons?: RejectReason[];
  preview_rows?: Record<string, unknown>[];
  imported_at: string;
}

export type IndicatorFamily =
  | "stock"
  | "transit"
  | "newness"
  | "sales"
  | "adjust"
  | "inbound"
  | "outbound"
  | "consignment"
  | "reservations"
  | "terrain";

export interface IndicatorSource {
  family: IndicatorFamily;
  file_type: string | null;
  file_name: string | null;
  file_id: string | null;
  imported_at: string | null;
  row_count: number;
  has_data: boolean;
}

export interface MappingRecord {
  id: string;
  file_type: string;
  canonical_field: CanonicalField;
  source_column: string;
  updated_at: string;
}

export type RiskLevel = "ok" | "attention" | "action";
export type DeptStatus = "open" | "in_progress" | "closed";

export interface DeptSummaryRow {
  dept_id: string;
  dept_name: string;
  stock_qty: number;
  transit_qty: number;
  inbound_qty: number;
  outbound_qty: number;
  newness_qty: number;
  sales_qty: number;
  sales_value: number;
  adjust_qty: number;
  adjust_value: number;
  reservations_qty: number;
  consignment_qty: number;
  expeditions_qty: number;
  fast_open: number;
  mao_open: number;
  risk: RiskLevel;
  hypothesis: string;
  action_taken: string;
  status: DeptStatus;
  updated_at: string;
}

// Department reference (friendly 100→945 range).
export interface Department {
  dept_code: string;
  sap_code: string | null;
  name: string;
  division: string;
}

// Per-department analyst notes (overrides consolidation risk).
export interface DeptNote {
  dept_code: string;
  risk: RiskLevel;
  comment: string;
  updated_at: string;
}

// Manual KPI overrides edited from the Home dashboard.
export interface KpiOverride {
  key: string;
  label: string;
  value_numeric: number;
  unit: "EUR" | "%" | "ratio";
  updated_at: string;
  updated_by: string;
}

// CITES regulated item.
export type DossierStatus = "todo" | "in_progress" | "complete" | "reexport_required";

export interface CitesItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  location: string;
  value: number;
  dossier_status: DossierStatus;
  docs_certificate: boolean;
  docs_invoice: boolean;
  docs_export: boolean;
  docs_photo: boolean;
  notes: string;
  updated_at: string;
}

// Packaging library item.
export interface PackagingItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  usage: string;
  tsl: string;
  on_hand: number;
  in_transit: number;
  reorder_threshold: number;
  sensitive: boolean;
  image_url: string;
  updated_at: string;
}

// A normalized event row extracted from an import after mapping is applied.
export interface NormalizedRow {
  deptId: string;
  deptName: string;
  sku?: string;
  reference?: string;
  quantity?: number;
  value?: number;
  date?: string;
  status?: string;
  destination?: string;
  recipient?: string;
  comment?: string;
  priority?: string;
  barcode?: string;
  name?: string;
  description?: string;
  location?: string;
}

// Destination splits used by Home and Evening dashboards.
export type DestinationZone = "France" | "Europe" | "UK" | "Autre";
