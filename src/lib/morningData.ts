import { supabase, DB } from "./supabase";

export interface NegativeStockNote {
  id: string;
  import_id: string;
  sku: string;
  department: string;
  note: string;
  updated_at: string;
}

export interface TransitNote {
  id: string;
  import_id: string;
  reference: string;
  sku: string;
  note: string;
  updated_at: string;
}

export async function fetchNegativeStockNotes(importIds: string[]): Promise<NegativeStockNote[]> {
  if (importIds.length === 0) return [];
  const { data, error } = await supabase
    .from("boh_negative_stock_notes")
    .select("*")
    .in("import_id", importIds);
  if (error) throw error;
  return (data ?? []) as unknown as NegativeStockNote[];
}

export async function fetchTransitNotes(importIds: string[]): Promise<TransitNote[]> {
  if (importIds.length === 0) return [];
  const { data, error } = await supabase
    .from("boh_transit_notes")
    .select("*")
    .in("import_id", importIds);
  if (error) throw error;
  return (data ?? []) as unknown as TransitNote[];
}

export async function upsertNegativeStockNote(
  importId: string,
  sku: string,
  department: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from("boh_negative_stock_notes")
    .upsert(
      { import_id: importId, sku, department, note, updated_at: new Date().toISOString() },
      { onConflict: "import_id,sku,department" }
    );
  if (error) throw error;
}

export async function upsertTransitNote(
  importId: string,
  reference: string,
  sku: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from("boh_transit_notes")
    .upsert(
      { import_id: importId, reference, sku, note, updated_at: new Date().toISOString() },
      { onConflict: "import_id,reference,sku" }
    );
  if (error) throw error;
}

void DB;
