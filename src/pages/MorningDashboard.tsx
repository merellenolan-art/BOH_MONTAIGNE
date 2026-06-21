import { useMemo, useState } from "react";
import {
  Truck, Sparkles, AlertTriangle, Clock, Search, RefreshCw, Upload,
} from "lucide-react";
import { SectionHeader, KpiCard, Spinner, RiskTag } from "../components/ui";
import { ShareActions } from "../components/ShareActions";
import { useDashboardExports } from "../lib/actions";
import {
  fmtNum, demoTransit, demoNegativeStock,
} from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";
import type { RiskLevel } from "../types";

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

  // TODO: when real transit/negative-stock imports exist, read from them.
  // For now use demo data (anonymized placeholders) until an MB52/VL06I file is imported.
  const transits = useMemo(() => demoTransit(), []);
  const negatives = useMemo(() => demoNegativeStock(), []);

  const transitOverWeek = transits.filter((t) => t.aging > 7).length;
  const transitQty = transits.reduce((a, t) => a + t.qty, 0);
  const newness = 142; // demo value
  const negativeCount = negatives.length;

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [zone, setZone] = useState("all");
  const [aging, setAging] = useState("all");

  const depts = useMemo(() =>
    [...new Set(transits.map((t) => String(t.destination).split(" ")[0]))].sort(),
    [transits]
  );

  const filteredTransits = useMemo(() =>
    transits.filter((t) => {
      if (zone !== "all" && t.zone !== zone) return false;
      if (dept !== "all" && t.destination !== dept) return false;
      if (aging === "ok" && t.aging > 2) return false;
      if (aging === "attention" && (t.aging <= 2 || t.aging > 6)) return false;
      if (aging === "action" && t.aging <= 6) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.invoice.toLowerCase().includes(q) && !t.sku.toLowerCase().includes(q) && !t.destination.toLowerCase().includes(q)) return false;
      }
      return true;
    }), [transits, zone, dept, aging, search]);

  const filteredNeg = useMemo(() => negatives.filter((n) => {
    if (dept !== "all" && n.dept !== dept) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!n.sku.toLowerCase().includes(q) && !n.qc.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [negatives, dept, search]);

  const { exportTable, copyWhatsApp } = useDashboardExports();

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
    { label: "Transit > 7j", value: fmtNum(transitOverWeek) },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Morning Report"
        title="Morning Dashboard"
        subtitle="Stock On Hand (MB52) & transit (VL06I) — anomalies et ancienneté des transits"
        actions={
          <>
            <ShareActions title="Morning Report" summary={waSummary} notify={notify} />
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pièces en transit" value={fmtNum(transitQty)} sub="VL06I" accent="steel" icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Newness" value={fmtNum(newness)} sub="Arrivages récents" accent="house" icon={<Sparkles className="h-4 w-4" />} />
        <KpiCard label="Stock négatif" value={fmtNum(negativeCount)} sub="Alerte MB52" accent="rose" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="Transit > 7 jours" value={fmtNum(transitOverWeek)} sub="À relancer" accent="amber" icon={<Clock className="h-4 w-4" />} />
      </div>

      {imports.length === 0 && (
        <EmptyBanner onImport={() => setView("import")} note="Données de démonstration anonymisées — importez MB52 et VL06I pour les remplacer." />
      )}

      {/* Negative stock */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">Stocks négatifs</h2>
        <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
            <input className="input pl-9" placeholder="Rechercher SKU, QC…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">Tous départements</option>
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
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
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">QC</th>
                  <th className="px-3 py-2.5 text-left">Département</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-left">Alerte</th>
                </tr>
              </thead>
              <tbody>
                {filteredNeg.map((n) => (
                  <tr key={n.sku} className="row-action">
                    <td className="px-3 py-2 font-mono text-xs">{n.sku}</td>
                    <td className="px-3 py-2">{n.qc}</td>
                    <td className="px-3 py-2 font-mono text-xs">{n.dept}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700">{fmtNum(n.qty)}</td>
                    <td className="px-3 py-2"><RiskTag level={n.risk} /></td>
                  </tr>
                ))}
                {filteredNeg.length === 0 && <tr><td colSpan={5} className="text-center text-graphite-400 py-6">Aucun stock négatif.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transits */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-graphite-700 uppercase tracking-wider">Transits (VL06I)</h2>
        </div>
        <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
            <input className="input pl-9" placeholder="Rechercher facture, SKU, destination…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select w-auto" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="all">Toutes destinations</option>
            <option value="France">France</option>
            <option value="Europe">Europe</option>
            <option value="UK">UK</option>
            <option value="Autre">Autre</option>
          </select>
          <select className="select w-auto" value={aging} onChange={(e) => setAging(e.target.value)}>
            <option value="all">Toutes anciennetés</option>
            <option value="ok">0-2 jours</option>
            <option value="attention">3-6 jours</option>
            <option value="action">7 jours et +</option>
          </select>
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
                  <th className="px-3 py-2.5 text-left">Facture</th>
                  <th className="px-3 py-2.5 text-left">Destination</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-right">Ancienneté</th>
                  <th className="px-3 py-2.5 text-left">Alerte</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransits.map((t) => (
                  <tr key={t.invoice} className={rowCls(t.risk)}>
                    <td className="px-3 py-2 font-mono text-xs">{t.invoice}</td>
                    <td className="px-3 py-2">{t.destination}</td>
                    <td className="px-3 py-2 text-xs">{t.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.qty)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.sku}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${t.aging > 7 ? "font-bold text-rose-700" : t.aging > 2 ? "text-amber-700" : ""}`}>
                      {t.aging} jours
                    </td>
                    <td className="px-3 py-2"><RiskTag level={t.risk} /></td>
                  </tr>
                ))}
                {filteredTransits.length === 0 && <tr><td colSpan={7} className="text-center text-graphite-400 py-6">Aucun transit.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {filteredTransits.some((t) => t.aging > 7) && (
          <div className="mt-3 card p-3 border-amber-200 bg-amber-50/50">
            <p className="text-sm font-medium text-amber-800">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              {filteredTransits.filter((t) => t.aging > 7).length} facture(s) en transit depuis plus d'une semaine — à relancer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyBanner({ onImport, note }: { onImport: () => void; note: string }) {
  return (
    <div className="card p-3 flex items-center gap-3 border-amber-200 bg-amber-50/50">
      <Upload className="h-4 w-4 text-amber-600" />
      <p className="text-xs text-amber-700 flex-1">{note}</p>
      <button className="btn-ghost text-xs" onClick={onImport}>Importer →</button>
    </div>
  );
}

function rowCls(risk: RiskLevel): string {
  return risk === "action" ? "row-action" : risk === "attention" ? "row-attention" : "";
}
