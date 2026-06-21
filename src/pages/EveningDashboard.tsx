import { useMemo } from "react";
import {
  Moon, ArrowDownToLine, ArrowUpFromLine, Send, ShoppingBag, Package,
  RefreshCw, Search,
} from "lucide-react";
import { SectionHeader, KpiCard, Spinner, ZoneTag } from "../components/ui";
import { ShareActions } from "../components/ShareActions";
import { useDashboardExports } from "../lib/actions";
import { demoEveningFlows, fmtEur, fmtNum } from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";
import type { DestinationZone } from "../types";

export function EveningDashboard({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { loading, refresh } = store;
  const flows = useMemo(() => demoEveningFlows(), []);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const receivedToday = flows.filter((f) => f.type === "Réception");
  const sentToday = flows.filter((f) => f.type === "Expédition");
  const expeditionsToday = sentToday.length;
  const maoRestant = 8; // demo
  const packagingRestant = 5; // demo

  const zones: DestinationZone[] = ["France", "Europe", "UK", "Autre"];
  const split = useMemo(() => {
    const map: Record<DestinationZone, number> = { France: 0, Europe: 0, UK: 0, Autre: 0 };
    flows.forEach((f) => { map[f.zone] += f.qty; });
    return map;
  }, [flows]);

  if (loading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Reçues aujourd'hui", value: fmtNum(receivedToday.length) },
    { label: "Envoyées aujourd'hui", value: fmtNum(sentToday.length) },
    { label: "Expéditions du jour", value: fmtNum(expeditionsToday) },
    { label: "MAO restant", value: fmtNum(maoRestant) },
    { label: "Packaging restant", value: fmtNum(packagingRestant) },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Evening Report"
        title="Evening Dashboard"
        subtitle="Indicateurs de clôture de journée — flux entrants, sortants et restes"
        actions={
          <>
            <ShareActions title="Evening Report" summary={waSummary} notify={notify} />
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Reçues aujourd'hui" value={fmtNum(receivedToday.length)} sub={`${fmtNum(receivedToday.reduce((a, f) => a + f.qty, 0))} pièces`} accent="house" icon={<ArrowDownToLine className="h-4 w-4" />} />
        <KpiCard label="Envoyées aujourd'hui" value={fmtNum(sentToday.length)} sub={`${fmtNum(sentToday.reduce((a, f) => a + f.qty, 0))} pièces`} accent="steel" icon={<ArrowUpFromLine className="h-4 w-4" />} />
        <KpiCard label="Expéditions du jour" value={fmtNum(expeditionsToday)} sub="FastShipment" accent="graphite" icon={<Send className="h-4 w-4" />} />
        <KpiCard label="MAO restant" value={fmtNum(maoRestant)} sub="E-commerce à traiter" accent="amber" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="Packaging restant" value={fmtNum(packagingRestant)} sub="À décharger" accent="rose" icon={<Package className="h-4 w-4" />} />
        <KpiCard label="Flux total" value={fmtNum(flows.length)} sub={`${fmtEur(flows.reduce((a, f) => a + f.value, 0))}`} accent="graphite" icon={<Moon className="h-4 w-4" />} />
      </div>

      {/* Destination split */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-graphite-900 mb-3">Répartition France / Europe / UK / Autre</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {zones.map((z) => (
            <div key={z} className="text-center p-3 rounded-lg border border-graphite-200">
              <ZoneTag zone={z} />
              <p className="mt-2 text-xl font-semibold text-graphite-900 tabular-nums">{fmtNum(split[z])}</p>
              <p className="text-[10px] text-graphite-400">pièces</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed flow table */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">Flux détaillés de la journée</h2>
        <div className="card p-3 flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
            <input className="input pl-9" placeholder="Rechercher référence, destination…" onChange={() => { /* filter in demo */ }} />
          </div>
          <button className="btn-ghost text-sm" onClick={() => exportTable("evening_flows.csv", flows as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("evening_flows.xlsx", flows as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Evening Report", waSummary); notify("Résumé WhatsApp copié"); }}>WhatsApp</button>
        </div>
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Référence</th>
                  <th className="px-3 py-2.5 text-left">Zone</th>
                  <th className="px-3 py-2.5 text-left">Destination</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-right">Valeur</th>
                  <th className="px-3 py-2.5 text-left">Heure</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.reference}>
                    <td className="px-3 py-2">
                      <span className={`tag ${f.type === "Réception" ? "tag-house" : "tag-neutral"}`}>{f.type}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{f.reference}</td>
                    <td className="px-3 py-2"><ZoneTag zone={f.zone} /></td>
                    <td className="px-3 py-2">{f.destination}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(f.qty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEur(f.value)}</td>
                    <td className="px-3 py-2 text-xs">{f.time}</td>
                  </tr>
                ))}
                {flows.length === 0 && <tr><td colSpan={7} className="text-center text-graphite-400 py-6">Aucun flux aujourd'hui.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-3 border-house-200 bg-house-50/30">
        <Package className="h-5 w-5 text-house-600" />
        <p className="text-sm text-graphite-700 flex-1">
          Restes à traiter : <strong>{maoRestant}</strong> commandes MAO e-commerce et <strong>{packagingRestant}</strong> articles packaging à décharger.
        </p>
        <button className="btn-ghost text-sm" onClick={() => setView("mao")}>Voir MAO →</button>
      </div>
    </div>
  );
}
