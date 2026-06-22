import { useMemo, useRef, useState } from "react";
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertTriangle, XCircle,
  SlidersHorizontal, RefreshCw, Layers, Clock, Eye,
} from "lucide-react";
import { SectionHeader, Spinner, EmptyState } from "../components/ui";
import type { StoreState } from "../lib/useStore";
import { persistAndRefresh } from "../lib/useStore";
import { parseWorkbook, saveImport, deleteImport, updateImportType } from "../lib/data";
import type { FileType, ImportRecord, ImportStatus, RejectReason } from "../types";
import { MappingPanel } from "../components/MappingPanel";

export function ImportCenter({
  store,
  notify,
}: {
  store: StoreState;
  notify: (m: string) => void;
}) {
  const { imports, fileTypes, mappings, loading, refresh } = store;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mappingFor, setMappingFor] = useState<ImportRecord | null>(null);
  const [previewFor, setPreviewFor] = useState<ImportRecord | null>(null);
  const [filter, setFilter] = useState<"all" | ImportStatus>("all");

  const fileTypesByCode = useMemo(() => {
    const m = new Map<string, FileType>();
    fileTypes.forEach((f) => m.set(f.code, f));
    return m;
  }, [fileTypes]);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBusy(true);
    let ok = 0, fail = 0;
    try {
      for (const f of arr) {
        try {
          const parsed = await parseWorkbook(f);
          const { detectedType } = await saveImport({
            fileName: parsed.fileName,
            sheetNames: parsed.sheetNames,
            headers: parsed.headers,
            rows: parsed.rows,
            fileTypes,
            existingMapping: mappings,
          });
          ok += 1;
          const ftName = detectedType ? fileTypesByCode.get(detectedType)?.name ?? detectedType : "inconnu";
          notify(`${f.name} — ${ftName} (${parsed.rows.length} lignes)`);
        } catch (e) {
          fail += 1;
          notify(`${f.name} — ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
      await persistAndRefresh(store);
      if (ok > 0) notify(`${ok} fichier(s) importé(s)${fail ? `, ${fail} échec(s)` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string, name: string) {
    if (!confirm(`Supprimer l'import "${name}" ?`)) return;
    setBusy(true);
    try {
      await deleteImport(id);
      await persistAndRefresh(store);
      notify(`Import supprimé : ${name}`);
    } finally { setBusy(false); }
  }

  async function onCorrectType(id: string, code: string) {
    if (!code) return;
    setBusy(true);
    try {
      const ft = fileTypes.find((f) => f.code === code);
      await updateImportType(id, code, ft);
      await persistAndRefresh(store);
      notify(`Type corrigé : ${ft?.name ?? code}`);
    } finally { setBusy(false); }
  }

  async function rebuild() {
    setBusy(true);
    try {
      await persistAndRefresh(store);
      notify("Synthèse reconstruite");
    } finally { setBusy(false); }
  }

  const filtered = imports.filter((i) => (filter === "all" ? true : i.status === filter));
  const counts = {
    all: imports.length,
    recognized: imports.filter((i) => i.status === "recognized").length,
    mapping_required: imports.filter((i) => i.status === "mapping_required").length,
    incompatible: imports.filter((i) => i.status === "incompatible").length,
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Données"
        title="Import Center"
        subtitle="Importez vos fichiers Excel — détection de type, mapping de colonnes, aperçu des données"
        actions={
          <>
            <button className="btn-ghost" onClick={rebuild} disabled={busy || imports.length === 0}>
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Reconstruire
            </button>
            <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4" /> Importer
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
          </>
        }
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        className={`card border-2 border-dashed transition-colors p-8 text-center ${dragOver ? "border-house-500 bg-house-50" : "border-graphite-300"}`}
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-graphite-100 text-graphite-600 flex items-center justify-center mb-3">
          {busy ? <Spinner className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
        </div>
        <p className="text-sm font-medium text-graphite-800">{busy ? "Import en cours…" : "Glissez-déposez vos fichiers ici"}</p>
        <p className="text-xs text-graphite-500 mt-1">XLSX, XLS, CSV — import unique ou multiple — fichiers terrain, SAP, FAST, MAO, CITES, Packaging, Oracle…</p>
      </div>

      {/* Supported types */}
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wider text-graphite-500 font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" /> Fichiers pris en charge ({fileTypes.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {fileTypes.map((ft) => {
            const count = imports.filter((i) => i.file_type === ft.code).length;
            return (
              <span key={ft.code} className={`tag ${count > 0 ? "bg-house-50 text-house-700" : "bg-graphite-100 text-graphite-600"}`} title={ft.expected_fields.join(", ")}>
                {ft.name}{count > 0 && <span className="ml-1 font-semibold">{count}</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* Imports list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-graphite-700 uppercase tracking-wider">Imports ({imports.length})</h2>
          <div className="flex gap-1 flex-wrap">
            <FilterBtn label={`Tous ${counts.all}`} active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterBtn label={`Reconnus ${counts.recognized}`} tone="ok" active={filter === "recognized"} onClick={() => setFilter("recognized")} />
            <FilterBtn label={`Mapping ${counts.mapping_required}`} tone="attention" active={filter === "mapping_required"} onClick={() => setFilter("mapping_required")} />
            <FilterBtn label={`Incompat. ${counts.incompatible}`} tone="error" active={filter === "incompatible"} onClick={() => setFilter("incompatible")} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-graphite-500"><Spinner className="h-5 w-5" /> <span className="ml-2">Chargement…</span></div>
        ) : filtered.length === 0 ? (
          <div className="card"><EmptyState icon={<FileSpreadsheet />} title={imports.length === 0 ? "Aucun import" : "Aucun import avec ce statut"} description={imports.length === 0 ? "Importez vos fichiers pour démarrer." : undefined} /></div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((imp) => (
              <ImportRow
                key={imp.id}
                imp={imp}
                fileTypes={fileTypes}
                fileType={imp.file_type ? fileTypesByCode.get(imp.file_type) ?? null : null}
                onRemove={() => onRemove(imp.id, imp.file_name)}
                onMap={() => setMappingFor(imp)}
                onPreview={() => setPreviewFor(imp)}
                onCorrectType={(code) => onCorrectType(imp.id, code)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>

      {mappingFor && (
        <MappingPanel
          imp={mappingFor}
          fileType={mappingFor.file_type ? fileTypesByCode.get(mappingFor.file_type) ?? null : null}
          mappings={mappings}
          onClose={() => setMappingFor(null)}
          onSaved={async () => { await persistAndRefresh(store); refresh(); }}
          notify={notify}
        />
      )}

      {previewFor && (
        <PreviewModal imp={previewFor} onClose={() => setPreviewFor(null)} />
      )}
    </div>
  );
}

function PreviewModal({ imp, onClose }: { imp: ImportRecord; onClose: () => void }) {
  const rows = imp.preview_rows ?? imp.rows.slice(0, 5);
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-rise" onClick={onClose} />
      <div className="relative bg-graphite-950 rounded-xl shadow-lift w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-graphite-200">
        <div className="px-5 py-3 border-b border-graphite-200 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-graphite-900">Aperçu — {imp.file_name}</h3>
            <p className="text-xs text-graphite-500 mt-0.5">{imp.row_count} lignes · {(imp.sheet_names ?? []).join(", ") || "feuille unique"}</p>
          </div>
          <button onClick={onClose} className="text-graphite-400 hover:text-graphite-900 text-xl leading-none">×</button>
        </div>
        <div className="overflow-auto scrollbar-thin">
          <table className="table-base w-full text-xs">
            <thead>
              <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c} className="whitespace-nowrap">{String(r[c] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-graphite-200 flex justify-end bg-graphite-100">
          <button onClick={onClose} className="btn-ghost text-sm">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function ImportRow({ imp, fileType, fileTypes, onRemove, onMap, onPreview, onCorrectType, busy }: {
  imp: ImportRecord; fileType: FileType | null; fileTypes: FileType[];
  onRemove: () => void; onMap: () => void; onPreview: () => void; onCorrectType: (code: string) => void; busy: boolean;
}) {
  const sheets = imp.sheet_names ?? [];
  const cols = useMemo(() => {
    const all = Object.values(imp.headers ?? {}).flat();
    return all.length > 0 ? Array.from(new Set(all)) : [];
  }, [imp.headers]);
  const accepted = imp.accepted_count ?? imp.row_count;
  const rejected = imp.rejected_count ?? 0;
  const reasons = imp.rejected_reasons ?? [];

  const statusIcon = imp.status === "recognized" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : imp.status === "mapping_required" ? <AlertTriangle className="h-4 w-4 text-amber-400" />
    : <XCircle className="h-4 w-4 text-rose-400" />;
  const statusLabel = imp.status === "recognized" ? "Reconnu" : imp.status === "mapping_required" ? "Mapping requis" : "Incompatible";

  return (
    <div className="card p-4 hover:shadow-soft transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-graphite-100 text-graphite-500 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-graphite-900 truncate">{imp.file_name}</p>
            <span className="flex items-center gap-1 text-xs font-medium text-graphite-500">{statusIcon} {statusLabel}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-graphite-500">
            <span><strong className="text-graphite-900">{imp.row_count}</strong> lignes</span>
            <span className="text-emerald-400"><strong>{accepted}</strong> acceptées</span>
            {rejected > 0 && <span className="text-rose-400"><strong>{rejected}</strong> rejetées</span>}
            <span><strong className="text-graphite-900">{sheets.length}</strong> feuille(s){sheets.length ? `: ${sheets.join(", ")}` : ""}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(imp.imported_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {cols.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {cols.slice(0, 10).map((c) => (
                <code key={c} className="text-[10px] px-1.5 py-0.5 bg-graphite-100 text-graphite-500 rounded font-mono">{c}</code>
              ))}
              {cols.length > 10 && <span className="text-[10px] px-1.5 py-0.5 text-graphite-400">+{cols.length - 10}</span>}
            </div>
          )}
          {reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {reasons.map((r: RejectReason, i) => (
                <div key={i} className="text-[11px] text-rose-300 flex items-center gap-1.5">
                  <XCircle className="h-3 w-3 shrink-0" />
                  <span>{r.reason}</span>
                  <span className="text-graphite-400">· {r.count} ligne(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <select
            value={imp.file_type ?? ""}
            onChange={(e) => onCorrectType(e.target.value)}
            disabled={busy}
            className="select w-auto py-1 text-xs"
            title="Corriger le type détecté"
          >
            <option value="">Type…</option>
            {fileTypes.map((ft) => (
              <option key={ft.code} value={ft.code}>{ft.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={onPreview} className="btn-ghost text-sm" disabled={busy} title="Aperçu">
              <Eye className="h-4 w-4" />
            </button>
            {fileType && (
              <button onClick={onMap} className="btn-ghost text-sm" disabled={busy} title="Vérifier le mapping">
                <SlidersHorizontal className="h-4 w-4" /> Mapping
              </button>
            )}
            <button onClick={onRemove} disabled={busy} className="btn-ghost text-sm text-rose-400 hover:bg-rose-900/30 hover:border-rose-700/40" title="Supprimer">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ label, active, onClick, tone = "neutral" }: {
  label: string; active: boolean; onClick: () => void; tone?: "neutral" | "ok" | "attention" | "error";
}) {
  const activeCls = tone === "ok" ? "bg-emerald-600 text-white" : tone === "attention" ? "bg-amber-500 text-white" : tone === "error" ? "bg-rose-600 text-white" : "bg-house-500 text-white";
  return (
    <button onClick={onClick} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${active ? activeCls : "bg-graphite-100 text-graphite-500 border border-graphite-200 hover:bg-graphite-200"}`}>
      {label}
    </button>
  );
}
