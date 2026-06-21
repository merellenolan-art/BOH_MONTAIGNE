import { useMemo, useState } from "react";
import {
  Package, LayoutGrid, List, AlertTriangle, RefreshCw, Search,
} from "lucide-react";
import { SectionHeader, EmptyState, Spinner, RiskTag } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import { demoPackaging, fmtNum } from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import type { PackagingItem, RiskLevel } from "../types";

export function PackagingDashboard({
  store,
  notify,
}: {
  store: StoreState;
  notify: (m: string) => void;
}) {
  const { packagingItems, loading, refresh } = store;
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);

  // Use real data if available; otherwise demo placeholders.
  const all = useMemo(() => packagingItems.length ? packagingItems : demoPackaging(), [packagingItems]);

  const items = useMemo(() => all.map(deriveRisk).filter((p) => {
    if (showAlertsOnly && p.risk === "ok") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) && !p.barcode.includes(q)) return false;
    }
    return true;
  }), [all, showAlertsOnly, search]);

  const { exportTable, copyWhatsApp } = useDashboardExports();
  const alertCount = all.filter((p) => deriveRisk(p).risk !== "ok").length;

  if (loading && all.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Références packaging", value: all.length },
    { label: "Alertes rupture", value: alertCount },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Packaging"
        title="Packaging Dashboard"
        subtitle="Bibliothèque visuelle de packaging — suivi rupture etalertes stock"
        actions={
          <>
            <div className="card p-1 flex gap-1">
              <button onClick={() => setView("cards")} className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${view === "cards" ? "bg-graphite-900 text-white" : "text-graphite-600"}`}>
                <LayoutGrid className="h-3.5 w-3.5 inline mr-1" /> Cartes
              </button>
              <button onClick={() => setView("table")} className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${view === "table" ? "bg-graphite-900 text-white" : "text-graphite-600"}`}>
                <List className="h-3.5 w-3.5 inline mr-1" /> Tableau
              </button>
            </div>
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher par nom, SKU, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-graphite-700 cursor-pointer">
          <input type="checkbox" checked={showAlertsOnly} onChange={(e) => setShowAlertsOnly(e.target.checked)} className="rounded border-graphite-300" />
          Alertes uniquement ({alertCount})
        </label>
        <div className="flex gap-1.5 sm:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("packaging.csv", items as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("packaging.xlsx", items as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Packaging", waSummary); notify("Résumé copié"); }}>WhatsApp</button>
        </div>
      </div>

      {alertCount > 0 && (
        <div className="card p-3 border-rose-200 bg-rose-50/40 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <p className="text-sm text-rose-800 font-medium flex-1">
            {alertCount} référence(s) packaging en rupture ou sous seuil de réapprovisionnement.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Package />} title="Aucun packaging à afficher" description="Ajustez la recherche ou importez une bibliothèque packaging." />
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => <PackageCard key={p.id} item={p} />)}
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Nom</th>
                  <th className="px-3 py-2.5 text-left">Usage</th>
                  <th className="px-3 py-2.5 text-left">TSL</th>
                  <th className="px-3 py-2.5 text-left">Barcode</th>
                  <th className="px-3 py-2.5 text-right">On-Hand</th>
                  <th className="px-3 py-2.5 text-right">Transit</th>
                  <th className="px-3 py-2.5 text-left">Statut</th>
                  <th className="px-3 py-2.5 text-left">Sensible</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const r = deriveRisk(p);
                  return (
                    <tr key={p.id} className={r.risk === "action" ? "row-action" : r.risk === "attention" ? "row-attention" : ""}>
                      <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-xs">{p.usage}</td>
                      <td className="px-3 py-2 text-xs">{p.tsl}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.risk !== "ok" ? "font-semibold text-rose-700" : ""}`}>{fmtNum(p.on_hand)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.in_transit)}</td>
                      <td className="px-3 py-2"><RiskTag level={r.risk} /></td>
                      <td className="px-3 py-2">{p.sensitive ? <span className="tag-house">Sensible</span> : <span className="tag-neutral">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface PackagingWithRisk extends PackagingItem { risk: RiskLevel }

function deriveRisk(p: PackagingItem): PackagingWithRisk {
  const total = p.on_hand + p.in_transit;
  if (p.on_hand <= 0) return { ...p, risk: "action" };
  if (p.on_hand < p.reorder_threshold) return { ...p, risk: "attention" };
  if (total < p.reorder_threshold) return { ...p, risk: "attention" };
  return { ...p, risk: "ok" };
}

function PackageCard({ item: p }: { item: PackagingWithRisk }) {
  return (
    <div className="card card-hover overflow-hidden">
      <div className="aspect-[4/3] bg-graphite-100 relative">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-graphite-400">
            <Package className="h-8 w-8" />
          </div>
        )}
        {p.risk !== "ok" && (
          <div className={`absolute top-2 right-2 ${p.risk === "action" ? "bg-rose-600" : "bg-amber-500"} text-white px-2 py-0.5 rounded-md text-[10px] font-bold`}>
            {p.risk === "action" ? "RUPTURE" : "À RÉAPPRO"}
          </div>
        )}
        {p.sensitive && (
          <div className="absolute top-2 left-2 bg-graphite-900/80 text-white px-2 py-0.5 rounded-md text-[10px] font-semibold">
            SENSIBLE
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-graphite-900">{p.name}</p>
          <RiskTag level={p.risk} />
        </div>
        <p className="text-xs text-graphite-500 mt-0.5 line-clamp-2">{p.description}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Field label="SKU" value={p.sku} />
          <Field label="TSL" value={p.tsl} />
          <Field label="On-Hand" value={fmtNum(p.on_hand)} emphasis={p.risk !== "ok"} />
          <Field label="Transit" value={fmtNum(p.in_transit)} />
          <Field label="Barcode" value={p.barcode} />
          <Field label="Usage" value={p.usage} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-graphite-400 font-semibold">{label}</p>
      <p className={`font-mono ${emphasis ? "font-semibold text-rose-700" : "text-graphite-700"}`}>{value}</p>
    </div>
  );
}
