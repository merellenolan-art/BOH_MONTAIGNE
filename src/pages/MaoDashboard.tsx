import { useMemo, useRef, useState } from "react";
import {
  ShoppingBag, RefreshCw, Search, AlertTriangle, Clock,
} from "lucide-react";
import { SectionHeader, KpiCard, EmptyState, Spinner, RiskTag } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import { demoMao, fmtNum } from "../lib/engine";
import { ShareDashboard } from "../components/ShareDashboard";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";
import type { RiskLevel } from "../types";

export function MaoDashboard({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { loading, refresh } = store;
  // Demo extraction already filtered to Montaigne-bound orders.
  const all = useMemo(() => demoMao(), []);
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const toPrepare = all.filter((m) => m.status === "À préparer").length;
  const oldOrders = all.filter((m) => m.aging > 3).length;

  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");

  const items = useMemo(() => all.filter((m) => {
    if (risk !== "all" && m.risk !== risk) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.reference.toLowerCase().includes(q) && !m.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [all, search, risk]);

  if (loading && all.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Commandes ouvertes", value: all.length },
    { label: "À préparer", value: toPrepare },
    { label: "Anciennes (>3j)", value: oldOrders },
  ];

  return (
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="E-commerce"
        title="E-commerce / MAO"
        subtitle="Commandes e-commerce destinées à la boutique Montaigne — préparation et ancienneté"
        actions={
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        }
      />

      <div className="card p-3 border-house-200 bg-house-50/30 flex items-center gap-3">
        <ShoppingBag className="h-4 w-4 text-house-600" />
        <p className="text-xs text-graphite-700 flex-1">
          Extraction filtrée automatiquement pour ne conserver que les commandes <strong>destinées à la boutique Montaigne</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Commandes ouvertes" value={fmtNum(all.length)} accent="house" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="À préparer" value={fmtNum(toPrepare)} accent="amber" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Anciennes (> 3 jours)" value={fmtNum(oldOrders)} sub="Alertes" accent="rose" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="En préparation" value={fmtNum(all.filter((m) => m.status === "En préparation").length)} accent="steel" icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher référence, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto" value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel | "all")}>
          <option value="all">Toutes alertes</option>
          <option value="ok">OK</option>
          <option value="attention">Attention</option>
          <option value="action">Action requise</option>
        </select>
        <div className="flex gap-1.5 sm:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("mao.csv", items as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("mao.xlsx", items as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("MAO", waSummary); notify("Résumé copié"); }}>WhatsApp</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<ShoppingBag />} title="Aucune commande MAO" description="Importez une extraction MAO / e-commerce pour démarrer." action={<button className="btn-primary" onClick={() => setView("import")}>Importer</button>} /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">Référence</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-right">Quantité</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-right">Ancienneté</th>
                  <th className="px-3 py-2.5 text-left">Statut</th>
                  <th className="px-3 py-2.5 text-left">Priorité</th>
                  <th className="px-3 py-2.5 text-left">Alerte</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.reference} className={rowCls(m.risk)}>
                    <td className="px-3 py-2 font-mono text-xs">{m.reference}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.sku}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.qty)}</td>
                    <td className="px-3 py-2 text-xs">{m.date}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.aging > 5 ? "font-bold text-rose-700" : m.aging > 2 ? "text-amber-700" : ""}`}>{m.aging} j</td>
                    <td className="px-3 py-2"><span className={`tag ${m.status === "Prête" ? "tag-ok" : m.status === "En attente client" ? "tag-attention" : "tag-neutral"}`}>{m.status}</span></td>
                    <td className="px-3 py-2">
                      <span className={`tag ${m.priority === "haute" ? "tag-action" : m.priority === "moyenne" ? "tag-attention" : "tag-neutral"}`}>{m.priority}</span>
                    </td>
                    <td className="px-3 py-2"><RiskTag level={m.risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ShareDashboard
        dashboardName="E-commerce / MAO"
        kpis={waSummary}
        alerts={oldOrders > 0 ? [`${oldOrders} commande(s) de plus de 3 jours`] : []}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}

function rowCls(risk: RiskLevel): string {
  return risk === "action" ? "row-action" : risk === "attention" ? "row-attention" : "";
}
