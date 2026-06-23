import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Truck, Sparkles, AlertTriangle, Clock, Search, RefreshCw, Upload,
  CheckCircle2, FileSpreadsheet,
} from "lucide-react";
import { SectionHeader, KpiCard, Spinner, RiskTag } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import {
  fmtNum,
  extractTransitRows,
  extractNegativeStockRows,
  excelDateToDate,
  transitAging,
  transitRisk,
  isVL06ITransit,
  isMB52Stock,
  sumDeliveryQuantity,
  countNegativeStock,
  countAgedTransits,
} from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";
import type { RiskLevel, ImportRecord } from "../types";
import {
  fetchNegativeStockNotes,
  fetchTransitNotes,
  upsertNegativeStockNote,
  upsertTransitNote,
  type NegativeStockNote,
  type TransitNote,
} from "../lib/morningData";
import { ShareDashboard } from "../components/ShareDashboard";

export function MorningDashboard({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { imports, loading, refresh } = store;
  const captureRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [negSearch, setNegSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [negDept, setNegDept] = useState("all");
  const [aging, setAging] = useState("all");
  const [onlyAged, setOnlyAged] = useState(false);

  const [negNotes, setNegNotes] = useState<NegativeStockNote[]>([]);
  const [transitNotes, setTransitNotes] = useState<TransitNote[]>([]);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const { exportTable, copyWhatsApp } = useDashboardExports();

  const latestVL06I = useMemo<ImportRecord | null>(() => {
    return imports
      .filter((i) => i.file_type === "transit" || isVL06ITransit(Object.values(i.headers ?? {}).flat()))
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0] ?? null;
  }, [imports]);

  const latestMB52 = useMemo<ImportRecord | null>(() => {
    return imports
      .filter((i) => i.file_type === "stock" || isMB52Stock(Object.values(i.headers ?? {}).flat()))
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0] ?? null;
  }, [imports]);

  const transitRows = useMemo(() => (latestVL06I ? extractTransitRows(latestVL06I) : []), [latestVL06I]);
  const negativeRows = useMemo(() => (latestMB52 ? extractNegativeStockRows(latestMB52) : []), [latestMB52]);

  useEffect(() => {
    const ids = [latestVL06I?.id, latestMB52?.id].filter(Boolean) as string[];
    if (ids.length === 0) { setNegNotes([]); setTransitNotes([]); return; }
    let cancelled = false;
    Promise.all([fetchTransitNotes(ids), fetchNegativeStockNotes(ids)])
      .then(([t, n]) => {
        if (cancelled) return;
        setTransitNotes(t);
        setNegNotes(n);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [latestVL06I?.id, latestMB52?.id]);

  const transitQty = useMemo(() => transitRows.reduce((a, r) => a + r.quantity, 0), [transitRows]);
  const newness = 0;
  const negativeCount = useMemo(() => negativeRows.length, [negativeRows]);
  const transitOverWeek = useMemo(() => transitRows.filter((r) => r.aging >= 8).length, [transitRows]);

  const depts = useMemo(() =>
    Array.from(new Set(transitRows.map((t) => t.department))).sort(),
    [transitRows]
  );
  const negDepts = useMemo(() =>
    Array.from(new Set(negativeRows.map((n) => n.department))).sort(),
    [negativeRows]
  );

  const filteredTransits = useMemo(() => {
    let rows = [...transitRows].sort((a, b) => b.aging - a.aging);
    if (onlyAged) rows = rows.filter((r) => r.aging >= 8);
    if (dept !== "all") rows = rows.filter((r) => r.department === dept);
    if (aging === "ok") rows = rows.filter((r) => r.aging <= 2);
    if (aging === "attention") rows = rows.filter((r) => r.aging >= 3 && r.aging <= 7);
    if (aging === "action") rows = rows.filter((r) => r.aging >= 8);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.reference.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [transitRows, onlyAged, dept, aging, search]);

  const filteredNeg = useMemo(() => {
    let rows = [...negativeRows];
    if (negDept !== "all") rows = rows.filter((r) => r.department === negDept);
    if (negSearch) {
      const q = negSearch.toLowerCase();
      rows = rows.filter((r) =>
        r.sku.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [negativeRows, negDept, negSearch]);

  const visibleTransitQty = filteredTransits.reduce((a, r) => a + r.quantity, 0);

  const transitNoteMap = useMemo(() => {
    const m = new Map<string, TransitNote>();
    for (const n of transitNotes) m.set(`${n.import_id}|${n.reference}|${n.sku}`, n);
    return m;
  }, [transitNotes]);

  const negNoteMap = useMemo(() => {
    const m = new Map<string, NegativeStockNote>();
    for (const n of negNotes) m.set(`${n.import_id}|${n.sku}|${n.department}`, n);
    return m;
  }, [negNotes]);

  const saveTransitNote = useCallback(async (key: string, reference: string, sku: string) => {
    if (!latestVL06I) return;
    const note = noteDraft[key] ?? "";
    try {
      await upsertTransitNote(latestVL06I.id, reference, sku, note);
      setTransitNotes((prev) => {
        const idx = prev.findIndex((p) => p.import_id === latestVL06I.id && p.reference === reference && p.sku === sku);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], note, updated_at: new Date().toISOString() };
          return copy;
        }
        return [...prev, { id: "", import_id: latestVL06I.id, reference, sku, note, updated_at: new Date().toISOString() }];
      });
      notify("Note sauvegardée");
    } catch { notify("Erreur de sauvegarde"); }
  }, [latestVL06I, noteDraft, notify]);

  const saveNegNote = useCallback(async (key: string, sku: string, department: string) => {
    if (!latestMB52) return;
    const note = noteDraft[key] ?? "";
    try {
      await upsertNegativeStockNote(latestMB52.id, sku, department, note);
      setNegNotes((prev) => {
        const idx = prev.findIndex((p) => p.import_id === latestMB52.id && p.sku === sku && p.department === department);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], note, updated_at: new Date().toISOString() };
          return copy;
        }
        return [...prev, { id: "", import_id: latestMB52.id, sku, department, note, updated_at: new Date().toISOString() }];
      });
      notify("Note sauvegardée");
    } catch { notify("Erreur de sauvegarde"); }
  }, [latestMB52, noteDraft, notify]);

  if (loading && imports.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Pièces en transit", value: fmtNum(transitQty) },
    { label: "Newness", value: fmtNum(newness) },
    { label: "Stock négatif", value: fmtNum(negativeCount) },
    { label: "Transit ≥ 8j", value: fmtNum(transitOverWeek) },
  ];

  const alerts: string[] = [];
  if (transitOverWeek > 0) alerts.push(`${transitOverWeek} transit(s) de 8 jours ou plus`);
  if (negativeCount > 0) alerts.push(`${negativeCount} stock(s) négatif(s)`);
  if (!latestVL06I) alerts.push("Fichier VL06I Transit manquant");
  if (!latestMB52) alerts.push("Fichier MB52 Stock manquant");

  return (
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="Morning Report"
        title="Morning Dashboard"
        subtitle="Stock On Hand (MB52) & transit (VL06I) — anomalies et ancienneté des transits"
        actions={
          <>
            <button className="btn-ghost" onClick={() => setView("import")}>
              <Upload className="h-4 w-4" /> Importer
            </button>
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      {!latestVL06I && !latestMB52 && (
        <div className="card p-3 border-l-2 border-amber-500/60 bg-amber-900/10 text-xs text-amber-200 flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          Aucun fichier importé. Les données seront affichées après import et validation du mapping.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pièces en transit" value={fmtNum(transitQty)} sub={latestVL06I ? latestVL06I.file_name : "Aucun import"} accent="steel" icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Newness" value={fmtNum(newness)} sub="Calcul à configurer" accent="house" icon={<Sparkles className="h-4 w-4" />} />
        <KpiCard label="Stock négatif" value={fmtNum(negativeCount)} sub={latestMB52 ? latestMB52.file_name : "Aucun import"} accent="rose" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Transit ≥ 8 jours" value={fmtNum(transitOverWeek)} sub="À relancer" accent="amber" icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* Source provenance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SourceCard label="VL06I Transit" imp={latestVL06I} rowsCount={transitRows.length} totalQty={transitQty} agedCount={transitOverWeek} onImport={() => setView("import")} />
        <SourceCard label="MB52 Stock On Hand" imp={latestMB52} rowsCount={negativeRows.length} negativeCount={negativeCount} onImport={() => setView("import")} />
      </div>

      {/* Stocks négatifs */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-900 mb-3 uppercase tracking-wider">Stocks négatifs</h2>
        <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
            <input className="input pl-9" placeholder="Rechercher SKU, style, description…" value={negSearch} onChange={(e) => setNegSearch(e.target.value)} />
          </div>
          <select className="select w-auto" value={negDept} onChange={(e) => setNegDept(e.target.value)}>
            <option value="all">Tous départements</option>
            {negDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="flex gap-1.5 sm:ml-auto">
            <button className="btn-ghost text-sm" onClick={() => exportTable("morning_negative_stock.csv", filteredNeg as unknown as Record<string, unknown>[], "csv")}>CSV</button>
            <button className="btn-ghost text-sm" onClick={() => exportTable("morning_negative_stock.xlsx", filteredNeg as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          </div>
        </div>
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Style</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-left">Département</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-left">Note / Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNeg.map((n, i) => {
                  const key = `${latestMB52?.id ?? ""}|${n.sku}|${n.department}`;
                  const note = negNoteMap.get(key)?.note ?? "";
                  const draft = noteDraft[key] ?? note;
                  return (
                    <tr key={i} className="row-action">
                      <td className="px-3 py-2 font-mono text-xs">{n.style}</td>
                      <td className="px-3 py-2 font-mono text-xs">{n.sku}</td>
                      <td className="px-3 py-2 text-xs">{n.description}</td>
                      <td className="px-3 py-2 font-mono text-xs">{n.department}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-400">{fmtNum(n.quantity)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="input py-1 text-xs"
                            value={draft}
                            placeholder="Ajouter une note…"
                            onChange={(e) => setNoteDraft((p) => ({ ...p, [key]: e.target.value }))}
                          />
                          <button className="btn-ghost text-xs px-2 py-1" onClick={() => saveNegNote(key, n.sku, n.department)} disabled={!latestMB52}>
                            OK
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredNeg.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-graphite-400 py-8 text-xs">
                      {!latestMB52
                        ? "Aucun fichier importé — importez un fichier Stock OH (MB52) pour afficher les données."
                        : "Aucun stock négatif."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transits */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-graphite-900 uppercase tracking-wider">Transits (VL06I)</h2>
        </div>
        <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
            <input className="input pl-9" placeholder="Rechercher facture, SKU, style, description…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">Tous départements</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="select w-auto" value={aging} onChange={(e) => setAging(e.target.value)}>
            <option value="all">Toutes anciennetés</option>
            <option value="ok">0-2 jours</option>
            <option value="attention">3-7 jours</option>
            <option value="action">8 jours et +</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-graphite-500 cursor-pointer">
            <input type="checkbox" checked={onlyAged} onChange={(e) => setOnlyAged(e.target.checked)} className="accent-house-500" />
            ≥ 8 jours
          </label>
          <div className="flex gap-1.5 sm:ml-auto">
            <button className="btn-ghost text-sm" onClick={() => exportTable("morning_transits.csv", filteredTransits as unknown as Record<string, unknown>[], "csv")}>CSV</button>
            <button className="btn-ghost text-sm" onClick={() => exportTable("morning_transits.xlsx", filteredTransits as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
            <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Morning Report", waSummary); notify("Résumé WhatsApp copié"); }}>WhatsApp</button>
          </div>
        </div>
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Facture / Livraison</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Style</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-left">Département</th>
                  <th className="px-3 py-2.5 text-right">Ancienneté</th>
                  <th className="px-3 py-2.5 text-left">Statut</th>
                  <th className="px-3 py-2.5 text-left">Note / Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransits.map((t, i) => {
                  const key = `${latestVL06I?.id ?? ""}|${t.reference}|${t.sku}`;
                  const note = transitNoteMap.get(key)?.note ?? "";
                  const draft = noteDraft[key] ?? note;
                  return (
                    <tr key={i} className={rowCls(t.risk)}>
                      <td className="px-3 py-2 text-xs">{t.date}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.reference}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.sku}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.style}</td>
                      <td className="px-3 py-2 text-xs">{t.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.quantity)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{t.department}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${t.risk === "action" ? "font-bold text-rose-400" : t.risk === "attention" ? "text-amber-300" : ""}`}>
                        {t.aging} j
                      </td>
                      <td className="px-3 py-2"><RiskTag level={t.risk} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="input py-1 text-xs"
                            value={draft}
                            placeholder="Ajouter une note…"
                            onChange={(e) => setNoteDraft((p) => ({ ...p, [key]: e.target.value }))}
                          />
                          <button className="btn-ghost text-xs px-2 py-1" onClick={() => saveTransitNote(key, t.reference, t.sku)}>
                            OK
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTransits.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-graphite-400 py-8 text-xs">
                      {!latestVL06I
                        ? "Aucun fichier importé — importez un fichier Transit (VL06I) pour afficher les données."
                        : "Aucun transit."}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredTransits.length > 0 && (
                <tfoot>
                  <tr className="bg-graphite-50 font-semibold">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs text-graphite-500">Total visible :</td>
                    <td className="px-3 py-2 text-right tabular-nums text-graphite-900">{fmtNum(visibleTransitQty)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        {transitOverWeek > 0 && (
          <div className="mt-3 card p-3 border-amber-700/40 bg-amber-900/20">
            <p className="text-sm font-medium text-amber-300">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              {transitOverWeek} facture(s) en transit depuis 8 jours ou plus — à relancer.
            </p>
          </div>
        )}
      </div>

      <ShareDashboard
        dashboardName="Morning Dashboard"
        kpis={waSummary}
        alerts={alerts}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}

function SourceCard({ label, imp, rowsCount, totalQty, negativeCount, agedCount, onImport }: {
  label: string;
  imp: ImportRecord | null;
  rowsCount: number;
  totalQty?: number;
  negativeCount?: number;
  agedCount?: number;
  onImport: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <FileSpreadsheet className="h-4 w-4 text-graphite-500" />
        <h3 className="text-sm font-semibold text-graphite-900">{label}</h3>
      </div>
      {imp ? (
        <div className="space-y-1 text-xs text-graphite-500">
          <p className="font-medium text-graphite-900 truncate">{imp.file_name}</p>
          <p>Importé le {new Date(imp.imported_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
          <p>{rowsCount} ligne(s) valide(s)</p>
          {totalQty !== undefined && <p>Somme quantité : <strong className="text-graphite-900">{fmtNum(totalQty)}</strong></p>}
          {negativeCount !== undefined && <p>Lignes négatives (K &lt; 0) : <strong className="text-graphite-900">{negativeCount}</strong></p>}
          {agedCount !== undefined && <p>Transits ≥ 8 jours : <strong className="text-graphite-900">{agedCount}</strong></p>}
          <p className="text-[10px] text-graphite-400 mt-1">Colonnes : {label.startsWith("VL06I") ? "B, E, K, L, M, N, AA" : "A, B, C, D, K"}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-xs text-graphite-400 flex-1">Aucune donnée importée</p>
          <button className="btn-ghost text-xs" onClick={onImport}>Importer →</button>
        </div>
      )}
    </div>
  );
}

function EmptySource({ text, onImport }: { text: string; onImport: () => void }) {
  return (
    <div className="card p-6 text-center">
      <Upload className="h-8 w-8 text-graphite-400 mx-auto mb-2" />
      <p className="text-sm text-graphite-400 mb-3">{text}</p>
      <button className="btn-ghost text-sm" onClick={onImport}>Importer un fichier →</button>
    </div>
  );
}

function rowCls(risk: RiskLevel): string {
  return risk === "action" ? "row-action" : risk === "attention" ? "row-attention" : "";
}

void CheckCircle2;
void excelDateToDate;
void transitAging;
void transitRisk;
void sumDeliveryQuantity;
void countNegativeStock;
void countAgedTransits;
