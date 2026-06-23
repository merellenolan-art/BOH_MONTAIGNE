import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal, RefreshCw, Search, Camera,
  TrendingUp, TrendingDown, Boxes, Euro, Package, FileWarning, CheckCircle2,
} from "lucide-react";
import { SectionHeader, EmptyState, Spinner, KpiCard } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import {
  extractAdjustmentRows, isAdjustmentFile, fmtNum, fmtEur,
} from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import { ShareDashboard } from "../components/ShareDashboard";
import type { AdjustmentRow } from "../lib/engine";

interface AdjRow extends AdjustmentRow {
  key: string;
  importId: string;
  importName: string;
}

const LS_NOTES_KEY = "boh_adjustment_notes";
const LS_PHOTOS_KEY = "boh_adjustment_photos";

function loadLs(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

function saveLs(key: string, data: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage may be full (photos) — silently ignore
  }
}

function rowKey(importId: string, sku: string, dept: string, date: string): string {
  return `${importId}::${sku}::${dept}::${date}`;
}

export function AdjustmentsDashboard({
  store,
  notify,
}: {
  store: StoreState;
  notify: (m: string) => void;
}) {
  const { imports, loading, refresh } = store;
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [signFilter, setSignFilter] = useState<"all" | "positive" | "negative">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [photoUploadKey, setPhotoUploadKey] = useState<string | null>(null);

  // Load notes & photos from localStorage on mount
  useEffect(() => {
    setNotes(loadLs(LS_NOTES_KEY));
    setPhotos(loadLs(LS_PHOTOS_KEY));
  }, []);

  // Extract adjustment rows from all recognized adjustment imports
  const { adjRows, adjustmentImports, detectedColumns, missingColumns } = useMemo(() => {
    const adjImps = imports.filter(
      (imp) => imp.status === "recognized" && isAdjustmentFile(
        Object.values(imp.headers ?? {})[0] ?? Object.keys(imp.rows[0] ?? {}),
        imp.file_name,
      )
    );
    const allHeaders = adjImps.length
      ? Object.values(adjImps[0].headers ?? {})[0] ?? Object.keys(adjImps[0].rows[0] ?? {})
      : [];

    const expectedColLabels = [
      "Date", "Département", "Style", "SKU/Material", "Description",
      "Quantité", "Valeur", "Raison", "Utilisateur",
    ];
    const normHeaders = allHeaders.map((h) => h.toLowerCase().trim());
    const missing = expectedColLabels.filter((label) => {
      const n = label.toLowerCase();
      return !normHeaders.some((h) => h.includes(n) || n.includes(h));
    });

    const rows: AdjRow[] = [];
    for (const imp of adjImps) {
      const extracted = extractAdjustmentRows(imp);
      for (const r of extracted) {
        const k = rowKey(imp.id, r.sku || r.style, r.department, r.date);
        rows.push({ ...r, key: k, importId: imp.id, importName: imp.file_name });
      }
    }

    return {
      adjRows: rows,
      adjustmentImports: adjImps,
      detectedColumns: allHeaders,
      missingColumns: missing,
    };
  }, [imports]);

  // Compute departments from data
  const departments = useMemo(() => {
    const set = new Set<string>();
    adjRows.forEach((r) => { if (r.department) set.add(r.department); });
    return [...set].sort();
  }, [adjRows]);

  // KPIs
  const kpis = useMemo(() => {
    const totalQty = adjRows.reduce((a, r) => a + r.quantity, 0);
    const totalValue = adjRows.reduce((a, r) => a + r.value, 0);
    const uniqueSkus = new Set(adjRows.map((r) => r.sku || r.style).filter(Boolean)).size;
    const posCount = adjRows.filter((r) => r.quantity > 0).length;
    const negCount = adjRows.filter((r) => r.quantity < 0).length;
    return { totalQty, totalValue, uniqueSkus, posCount, negCount };
  }, [adjRows]);

  // Per-department KPIs
  const deptKpis = useMemo(() => {
    const map = new Map<string, { qty: number; value: number; count: number }>();
    for (const r of adjRows) {
      const d = r.department || "N/A";
      const entry = map.get(d) ?? { qty: 0, value: 0, count: 0 };
      entry.qty += r.quantity;
      entry.value += r.value;
      entry.count += 1;
      map.set(d, entry);
    }
    return [...map.entries()]
      .map(([dept, v]) => ({ dept, ...v }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [adjRows]);

  // Apply filters
  const filtered = useMemo(() => {
    return adjRows.filter((r) => {
      if (deptFilter && r.department !== deptFilter) return false;
      if (skuFilter && !(r.sku || "").toLowerCase().includes(skuFilter.toLowerCase())) return false;
      if (dateFilter && !(r.date || "").includes(dateFilter)) return false;
      if (signFilter === "positive" && r.quantity <= 0) return false;
      if (signFilter === "negative" && r.quantity >= 0) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.sku, r.style, r.description, r.department, r.reason, r.user].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [adjRows, search, deptFilter, skuFilter, dateFilter, signFilter]);

  const handleNoteChange = useCallback((key: string, value: string) => {
    setNotes((prev) => {
      const next = { ...prev, [key]: value };
      saveLs(LS_NOTES_KEY, next);
      return next;
    });
  }, []);

  const handlePhotoSelect = useCallback((key: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos((prev) => {
        const next = { ...prev, [key]: dataUrl };
        try {
          localStorage.setItem(LS_PHOTOS_KEY, JSON.stringify(next));
        } catch {
          notify("Espace de stockage insuffisant — la photo ne peut pas être sauvegardée localement.");
          return prev;
        }
        return next;
      });
      setPhotoUploadKey(null);
      notify("Photo ajoutée");
    };
    reader.readAsDataURL(file);
  }, [notify]);

  const waSummary = useMemo(() => [
    { label: "Pièces ajustées", value: fmtNum(kpis.totalQty) },
    { label: "Valeur ajustée", value: fmtEur(kpis.totalValue) },
    { label: "SKU uniques", value: fmtNum(kpis.uniqueSkus) },
    { label: "Ajustements positifs", value: fmtNum(kpis.posCount) },
    { label: "Ajustements négatifs", value: fmtNum(kpis.negCount) },
    ...deptKpis.slice(0, 5).map((d) => ({ label: `${d.dept}`, value: fmtEur(d.value) })),
  ], [kpis, deptKpis]);

  const waExtra = useMemo(() => {
    const top = deptKpis.slice(0, 3).map((d) => `- ${d.dept} : ${fmtEur(d.value)}`).join("\n");
    return `Départements les plus impactés :\n${top || "N/A"}`;
  }, [deptKpis]);

  if (loading && adjRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  return (
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="Flux & Pilotage"
        title="Adjustments Dashboard"
        subtitle="Suivi des ajustements d'inventaire — fichiers Adjust SAP, Adjustment, Adjustments"
        actions={
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        }
      />

      {/* Source files info */}
      {adjustmentImports.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-graphite-900 mb-2">
            Fichiers d'ajustement détectés ({adjustmentImports.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adjustmentImports.map((imp) => (
              <div key={imp.id} className="rounded-lg border border-graphite-200 p-3 bg-graphite-50/50">
                <p className="text-sm font-medium text-graphite-800 truncate">{imp.file_name}</p>
                <p className="text-xs text-graphite-500 mt-0.5">
                  {imp.row_count} lignes · {new Date(imp.imported_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Column robustness info */}
      {adjustmentImports.length > 0 && (
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <FileWarning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-graphite-900">Colonnes détectées</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {detectedColumns.map((c, i) => (
                  <span key={i} className="tag tag-ok">{c}</span>
                ))}
              </div>
              {missingColumns.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-graphite-900 mt-3">Colonnes manquantes</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {missingColumns.map((c, i) => (
                      <span key={i} className="tag tag-attention">{c}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Pièces ajustées" value={fmtNum(kpis.totalQty)} accent="house" icon={<Boxes className="h-4 w-4" />} />
        <KpiCard label="Valeur ajustée" value={fmtEur(kpis.totalValue)} accent="steel" icon={<Euro className="h-4 w-4" />} />
        <KpiCard label="SKU ajustés" value={fmtNum(kpis.uniqueSkus)} accent="graphite" icon={<Package className="h-4 w-4" />} />
        <KpiCard label="Ajustements positifs" value={fmtNum(kpis.posCount)} accent="emerald" icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Ajustements négatifs" value={fmtNum(kpis.negCount)} accent="rose" icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      {/* Per-department KPIs */}
      {deptKpis.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-graphite-900 mb-3">KPI par département</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {deptKpis.map((d) => (
              <div key={d.dept} className="rounded-lg border border-graphite-200 p-3 bg-white">
                <p className="text-xs uppercase tracking-wider text-graphite-400 font-semibold">{d.dept}</p>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] text-graphite-400">Pièces</p>
                    <p className="text-lg font-semibold tabular-nums text-graphite-900">{fmtNum(d.qty)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-graphite-400">Valeur</p>
                    <p className={`text-lg font-semibold tabular-nums ${d.value < 0 ? "text-rose-700" : "text-graphite-900"}`}>
                      {fmtEur(d.value)}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-graphite-400 mt-1">{d.count} ajustement(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher (SKU, style, description, raison…)"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input lg:w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">Tous départements</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="input lg:w-32" placeholder="SKU" value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)} />
        <input type="date" className="input lg:w-40" value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)} />
        <div className="card p-1 flex gap-1">
          {(["all", "positive", "negative"] as const).map((s) => (
            <button key={s} onClick={() => setSignFilter(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${signFilter === s ? "bg-graphite-900 text-white" : "text-graphite-600"}`}>
              {s === "all" ? "Tous" : s === "positive" ? "Positifs" : "Négatifs"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 lg:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("adjustments.csv", filtered as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("adjustments.xlsx", filtered as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Adjustments Dashboard", waSummary, waExtra); notify("Résumé copié"); }}>WhatsApp</button>
        </div>
      </div>

      {/* Main table */}
      {adjRows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<SlidersHorizontal />}
            title="Aucun ajustement à afficher"
            description="Importez un fichier Adjust SAP, Adjustment ou Adjustments depuis l'Import Center pour peupler ce dashboard."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Search />} title="Aucun résultat" description="Ajustez les filtres pour voir des résultats." />
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Dépt</th>
                  <th className="px-3 py-2.5 text-left">Style</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-right">Qté</th>
                  <th className="px-3 py-2.5 text-right">Valeur</th>
                  <th className="px-3 py-2.5 text-left">Raison</th>
                  <th className="px-3 py-2.5 text-left">Utilisateur</th>
                  <th className="px-3 py-2.5 text-left">Note</th>
                  <th className="px-3 py-2.5 text-center">Photo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isNeg = r.quantity < 0;
                  return (
                    <tr key={r.key} className={isNeg ? "row-action" : ""}>
                      <td className="px-3 py-2 text-xs text-graphite-600 whitespace-nowrap">{r.date || "—"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{r.department || "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.style || "—"}</td>
                      <td className="px-3 py-2 text-xs font-mono">{r.sku || "—"}</td>
                      <td className="px-3 py-2 text-xs text-graphite-600 max-w-[180px] truncate" title={r.description}>{r.description || "—"}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${isNeg ? "text-rose-700" : "text-emerald-700"}`}>
                        {fmtNum(r.quantity)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.value < 0 ? "text-rose-700" : "text-graphite-700"}`}>
                        {fmtEur(r.value)}
                      </td>
                      <td className="px-3 py-2 text-xs text-graphite-600">{r.reason || "—"}</td>
                      <td className="px-3 py-2 text-xs text-graphite-600">{r.user || "—"}</td>
                      <td className="px-3 py-2">
                        <input
                          className="input w-32 text-xs py-1"
                          placeholder="Ajouter une note…"
                          value={notes[r.key] ?? ""}
                          onChange={(e) => handleNoteChange(r.key, e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {photos[r.key] ? (
                            <img src={photos[r.key]} alt="Photo" className="h-8 w-8 rounded object-cover border border-graphite-200" />
                          ) : (
                            photoUploadKey === r.key ? (
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                ref={(el) => {
                                  if (el) {
                                    el.onchange = (e) => {
                                      const f = (e.target as HTMLInputElement).files?.[0];
                                      if (f) handlePhotoSelect(r.key, f);
                                    };
                                    el.click();
                                  }
                                }}
                              />
                            ) : null
                          )}
                          <button
                            className="btn-ghost text-xs px-2 py-1"
                            onClick={() => setPhotoUploadKey(r.key)}
                            title="Ajouter photo"
                          >
                            {photos[r.key] ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Camera className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ShareDashboard
        dashboardName="Adjustments Dashboard"
        kpis={waSummary}
        alerts={kpis.negCount > 0 ? [`${kpis.negCount} ajustement(s) négatif(s)`] : []}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}
