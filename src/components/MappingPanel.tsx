import { useMemo, useState, useEffect } from "react";
import { X, Save, Sparkles, AlertCircle } from "lucide-react";
import { suggestMapping } from "../lib/engine";
import { saveMapping } from "../lib/data";
import { Spinner } from "./ui";
import type { CanonicalField } from "../types";
import type { FileType, ImportRecord, MappingRecord } from "../types";

const FIELD_LABELS: Record<CanonicalField, string> = {
  sku: "SKU / Article",
  department: "Department ID",
  departmentName: "Department Name",
  quantity: "Quantity",
  value: "Value",
  date: "Date",
  reference: "Reference",
  status: "Status",
  destination: "Destination",
  recipient: "Destinataire",
  comment: "Commentaire",
  barcode: "Barcode",
  name: "Nom",
  description: "Description",
  location: "Emplacement",
  priority: "Priorité",
};

const FIELD_HINTS: Record<CanonicalField, string> = {
  sku: "SKU, Material, Article, Barcode, GTIN",
  department: "Dept, Dept ID, Department, Division",
  departmentName: "Dept Name, Department Name",
  quantity: "Qty, Quantity, Stock, On Hand",
  value: "Amount, Sales Value, Value",
  date: "Created Date, Released Date, Delivery Date",
  reference: "Reference, Document, Order, Invoice",
  status: "Status, State, Stage",
  destination: "Destination, Ship-to, Country, Zone",
  recipient: "Recipient, Customer, Client",
  comment: "Comment, Note, Remark",
  barcode: "Barcode, EAN, UPC",
  name: "Name, Label, Libellé",
  description: "Description, Detail",
  location: "Location, Emplacement, Shelf",
  priority: "Priority, Urgency",
};

export function MappingPanel({
  imp, fileType, mappings, onClose, onSaved, notify,
}: {
  imp: ImportRecord;
  fileType: FileType | null;
  mappings: MappingRecord[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  notify: (m: string) => void;
}) {
  const headers = useMemo(() => {
    const first = Object.values(imp.headers ?? {})[0] ?? [];
    return Array.from(new Set(first));
  }, [imp]);

  const saved = useMemo(() => {
    const map: Partial<Record<CanonicalField, string>> = {};
    mappings.filter((m) => m.file_type === imp.file_type).forEach((m) => {
      map[m.canonical_field as CanonicalField] = m.source_column;
    });
    return map;
  }, [mappings, imp.file_type]);

  const suggestions = useMemo(
    () => (fileType ? suggestMapping(headers, fileType.expected_fields as string[]) : {}),
    [headers, fileType]
  );

  const [draft, setDraft] = useState<Partial<Record<CanonicalField, string>>>(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft((d) => ({ ...suggestions, ...d }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  if (!fileType) {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-6">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-graphite-800">Type de fichier non détecté</p>
          <p className="text-xs text-graphite-500 mt-1">Impossible de proposer un mapping automatique. Vérifiez le contenu du fichier.</p>
        </div>
      </Modal>
    );
  }

  const set = (field: CanonicalField, col: string) => setDraft((d) => ({ ...d, [field]: col || undefined }));
  const applySuggestion = (field: CanonicalField) => {
    const suggested = suggestions[field];
    if (suggested) set(field, suggested);
  };

  async function save() {
    setSaving(true);
    try {
      const ft = fileType!;
      const entries = Object.entries(draft).filter(([, col]) => col) as [CanonicalField, string][];
      for (const [field, col] of entries) {
        await saveMapping(ft.code, field, col);
      }
      notify("Mapping enregistré");
      await onSaved();
      onClose();
    } catch (e) {
      notify(`Erreur mapping : ${e instanceof Error ? e.message : e}`);
    } finally { setSaving(false); }
  }

  const mappedCount = Object.values(draft).filter(Boolean).length;
  const totalFields = fileType.expected_fields.length;

  return (
    <Modal onClose={onClose} wide>
      <div className="px-5 py-4 border-b border-graphite-100 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl font-semibold text-graphite-900">Mapping intelligent</h3>
          <p className="text-xs text-graphite-500 mt-0.5">
            {imp.file_name} · <span className="text-house-700 font-medium">{fileType.name}</span> · {mappedCount}/{totalFields} champs associés
          </p>
        </div>
        <button onClick={onClose} className="text-graphite-400 hover:text-graphite-700"><X className="h-5 w-5" /></button>
      </div>

      <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fileType.expected_fields.map((field) => {
            const f = field as CanonicalField;
            const chosen = draft[f] ?? "";
            const suggested = suggestions[f];
            const differs = suggested && chosen !== suggested;
            return (
              <div key={f} className="border border-graphite-200 rounded-lg p-3 bg-graphite-50/30">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-graphite-800">{FIELD_LABELS[f]}</p>
                    <p className="text-[11px] text-graphite-500">{FIELD_HINTS[f]}</p>
                  </div>
                  {suggested && (
                    <button onClick={() => applySuggestion(f)} className="inline-flex items-center gap-1 text-[11px] text-house-600 hover:text-house-800 font-medium">
                      <Sparkles className="h-3 w-3" />{differs ? "appliquer" : "suggéré"}
                    </button>
                  )}
                </div>
                <select value={chosen} onChange={(e) => set(f, e.target.value)} className="select mt-2">
                  <option value="">— Aucune —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {suggested && chosen === suggested && (
                  <p className="mt-1 text-[11px] text-house-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Suggestion automatique appliquée
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-graphite-100 flex items-center justify-between gap-3 bg-graphite-50/40">
        <p className="text-xs text-graphite-500">Le mapping est sauvegardé et réutilisé pour les prochains imports de ce type.</p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-graphite-900/40 backdrop-blur-sm animate-rise" onClick={onClose} />
      <div className={`relative bg-white rounded-t-xl sm:rounded-xl shadow-lift w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-hidden animate-rise`}>
        {children}
      </div>
    </div>
  );
}
