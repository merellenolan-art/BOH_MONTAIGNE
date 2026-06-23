import { useMemo, useRef } from "react";
import {
  Moon, ArrowDownToLine, ArrowUpFromLine, Send, ShoppingBag, Package,
  RefreshCw, Search, AlertTriangle,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { SectionHeader, KpiCard, Spinner, ZoneTag } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import { demoEveningFlows, fmtEur, fmtNum } from "../lib/engine";
import { ShareDashboard } from "../components/ShareDashboard";
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
  const { imports, loading, refresh } = store;
  const flows = useMemo(() => demoEveningFlows(), []);
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const receivedToday = flows.filter((f) => f.type === "Réception");
  const sentToday = flows.filter((f) => f.type === "Expédition");
  const expeditionsToday = sentToday.length;
  const maoRestant = 8; // demo
  const packagingRestant = 5; // demo

  const zones: DestinationZone[] = ["France", "Europe", "Trecate", "Autre"];
  const split = useMemo(() => {
    const map: Record<DestinationZone, number> = { France: 0, Europe: 0, Trecate: 0, Autre: 0 };
    flows.forEach((f) => { map[f.zone] += f.qty; });
    return map;
  }, [flows]);

  const latestInbound = useMemo(() =>
    imports
      .filter((i) => i.file_type === "inbound")
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0] ?? null,
    [imports]
  );
  const latestOutbound = useMemo(() =>
    imports
      .filter((i) => i.file_type === "outbound")
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0] ?? null,
    [imports]
  );

  // Destination zones for inbound/outbound — columns to be configured via mapping
  const emptyFlowZones: FlowZoneData[] = FLOW_ZONE_DEFS.map((z) => ({ ...z, qty: 0 }));
  const inboundZones = emptyFlowZones;
  const outboundZones = emptyFlowZones;

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
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="Evening Report"
        title="Evening Dashboard"
        subtitle="Indicateurs de clôture de journée — flux entrants, sortants et restes"
        actions={
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
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
        <h3 className="text-sm font-semibold text-graphite-900 mb-3">Répartition France / Europe / Trecate / Autre</h3>
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

      {/* Répartition par destination — Inbound / Outbound */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">
          Répartition par destination
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DestinationFlowCard
            title="Répartition Inbound"
            zones={inboundZones}
            hasImport={!!latestInbound}
            importName={latestInbound?.file_name}
          />
          <DestinationFlowCard
            title="Répartition Outbound"
            zones={outboundZones}
            hasImport={!!latestOutbound}
            importName={latestOutbound?.file_name}
          />
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
      <ShareDashboard
        dashboardName="Evening Dashboard"
        kpis={waSummary}
        alerts={[]}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Destination flow zones                                               */
/* ------------------------------------------------------------------ */

interface FlowZoneData {
  label: string;
  color: string;
  qty: number;
}

const FLOW_ZONE_DEFS = [
  { label: "France",         color: "#C9A96E" },
  { label: "Europe",         color: "#4B8FC0" },
  { label: "Intercontinent", color: "#10b981" },
];

function DestinationFlowCard({
  title,
  zones,
  hasImport,
  importName,
}: {
  title: string;
  zones: FlowZoneData[];
  hasImport: boolean;
  importName?: string;
}) {
  const total = zones.reduce((a, z) => a + z.qty, 0);
  const isEmpty = total === 0;

  const chartData = isEmpty
    ? [{ name: "—", value: 1, color: "#2d3748" }]
    : zones.map((z) => ({ name: z.label, value: z.qty, color: z.color }));

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-graphite-900">{title}</h3>
          {importName && (
            <p className="text-[10px] text-graphite-400 mt-0.5 truncate max-w-[220px]">{importName}</p>
          )}
        </div>
        {!hasImport && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
            <AlertTriangle className="h-3 w-3" /> Aucun import
          </span>
        )}
      </div>

      {!hasImport && (
        <p className="text-xs text-graphite-400 mb-3 leading-relaxed">
          Aucune donnée importée. Les données seront affichées après import et validation du mapping.
        </p>
      )}
      {hasImport && isEmpty && (
        <p className="text-xs text-graphite-400 mb-3 leading-relaxed">
          Répartition disponible après configuration du mapping destination.
        </p>
      )}

      <div className="flex items-center gap-5">
        <div className="shrink-0">
          <PieChart width={108} height={108}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={48}
              dataKey="value"
              strokeWidth={isEmpty ? 0 : 1}
              stroke={isEmpty ? "transparent" : "#1a1a2e"}
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </div>

        <div className="flex-1 space-y-2">
          {zones.map((z) => {
            const pct = total > 0 ? Math.round((z.qty / total) * 100) : 0;
            return (
              <div key={z.label} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: z.color }}
                />
                <span className="text-xs text-graphite-500 flex-1">{z.label}</span>
                <span className="text-xs font-semibold text-graphite-900 tabular-nums">
                  {fmtNum(z.qty)}
                </span>
                <span className="text-[10px] text-graphite-400 w-8 text-right tabular-nums">
                  {pct}%
                </span>
              </div>
            );
          })}
          <div className="pt-2 border-t border-graphite-100 flex items-center justify-between">
            <span className="text-xs text-graphite-400">Total</span>
            <span className="text-xs font-semibold text-graphite-700 tabular-nums">
              {fmtNum(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
