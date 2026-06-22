import { useMemo, useRef, useState } from "react";
import {
  Truck, RefreshCw, Search, AlertTriangle, AlertOctagon,
} from "lucide-react";
import { SectionHeader, KpiCard, EmptyState, Spinner, RiskTag, ZoneTag } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import { demoExpeditions, fmtEur, fmtNum } from "../lib/engine";
import { ShareDashboard } from "../components/ShareDashboard";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";
import type { DestinationZone, RiskLevel } from "../types";

export function ExpeditionsDashboard({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { loading, refresh } = store;
  const all = useMemo(() => demoExpeditions(), []);
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const today = useMemo(() => all.slice(0, 5), [all]); // top 5 = "du jour" for demo
  const blocked = all.filter((e) => e.blocked);

  const [search, setSearch] = useState("");
  const [zone, setZone] = useState<DestinationZone | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");

  const items = useMemo(() => all.filter((e) => {
    if (zone !== "all" && e.zone !== zone) return false;
    if (risk !== "all" && e.risk !== risk) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.reference.toLowerCase().includes(q) && !e.destination.toLowerCase().includes(q) && !e.recipient.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [all, search, zone, risk]);

  if (loading && all.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Expéditions", value: all.length },
    { label: "Du jour", value: today.length },
    { label: "Bloquées", value: blocked.length },
    { label: "Valeur totale", value: fmtEur(all.reduce((a, e) => a + e.value, 0)) },
  ];

  const destinations = useMemo(() => [...new Set(all.map((e) => e.destination))].sort(), [all]);

  return (
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="FastShipment"
        title="Expéditions"
        subtitle="Suivi des expéditions FastShipment — destinations, statuts et écarts bloqués"
        actions={
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Expéditions (total)" value={fmtNum(all.length)} accent="steel" icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Du jour" value={fmtNum(today.length)} accent="house" icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Destinations" value={fmtNum(destinations.length)} accent="graphite" icon={<AlertOctagon className="h-4 w-4" />} />
        <KpiCard label="Bloquées" value={fmtNum(blocked.length)} sub="Action requise" accent="rose" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {blocked.length > 0 && (
        <div className="card p-3 border-rose-200 bg-rose-50/40 flex items-center gap-3">
          <AlertOctagon className="h-5 w-5 text-rose-600" />
          <p className="text-sm text-rose-800 font-medium flex-1">
            {blocked.length} expédition(s) bloquée(s) ou non finalisée(s).
          </p>
        </div>
      )}

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher référence, destinataire, destination…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto" value={zone} onChange={(e) => setZone(e.target.value as DestinationZone | "all")}>
          <option value="all">Toutes destinations</option>
          <option value="France">France</option>
          <option value="Europe">Europe</option>
          <option value="UK">UK</option>
          <option value="Autre">Autre</option>
        </select>
        <select className="select w-auto" value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | "all")}>
          <option value="all">Tous statuts</option>
          <option value="ok">OK</option>
          <option value="attention">Attention</option>
          <option value="action">Action requise</option>
        </select>
        <div className="flex gap-1.5 sm:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("expeditions.csv", items as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("expeditions.xlsx", items as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Expéditions", waSummary); notify("Résumé copié"); }}>WhatsApp</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<Truck />} title="Aucune expédition" description="Importez un fichier FastShipment pour démarrer." action={<button className="btn-primary" onClick={() => setView("import")}>Importer</button>} /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Référence</th>
                  <th className="px-3 py-2.5 text-left">Destination</th>
                  <th className="px-3 py-2.5 text-left">Zone</th>
                  <th className="px-3 py-2.5 text-left">Destinataire</th>
                  <th className="px-3 py-2.5 text-left">Statut</th>
                  <th className="px-3 py-2.5 text-right">Valeur déclarée</th>
                  <th className="px-3 py-2.5 text-right">Ancienneté</th>
                  <th className="px-3 py-2.5 text-left">Alerte</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.reference} className={rowCls(e.risk)}>
                    <td className="px-3 py-2 font-mono text-xs">{e.reference}</td>
                    <td className="px-3 py-2">{e.destination}</td>
                    <td className="px-3 py-2"><ZoneTag zone={e.zone} /></td>
                    <td className="px-3 py-2 text-xs">{e.recipient}</td>
                    <td className="px-3 py-2">
                      <span className={`tag ${e.blocked ? "tag-action" : e.status === "Livrée" ? "tag-ok" : "tag-neutral"}`}>{e.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEur(e.value)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${e.aging > 6 ? "font-bold text-rose-700" : e.aging > 2 ? "text-amber-700" : ""}`}>{e.aging} j</td>
                    <td className="px-3 py-2"><RiskTag level={e.risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ShareDashboard
        dashboardName="Expéditions"
        kpis={waSummary}
        alerts={blocked.length > 0 ? [`${blocked.length} expédition(s) bloquée(s)`] : []}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}

function rowCls(risk: RiskLevel): string {
  return risk === "action" ? "row-action" : risk === "attention" ? "row-attention" : "";
}
