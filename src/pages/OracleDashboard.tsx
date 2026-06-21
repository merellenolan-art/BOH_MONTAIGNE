import { useMemo, useState } from "react";
import {
  Receipt, RefreshCw, Search, AlertTriangle, CheckCircle2, Scale,
} from "lucide-react";
import { SectionHeader, EmptyState, Spinner } from "../components/ui";
import { ShareActions } from "../components/ShareActions";
import { useDashboardExports } from "../lib/actions";
import { demoOracleSap, fmtEur, fmtNum } from "../lib/engine";
import type { StoreState } from "../lib/useStore";
import type { View } from "../components/Layout";

export function OracleDashboard({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { loading, refresh } = store;
  const all = useMemo(() => demoOracleSap(), []);
  const { exportTable, copyWhatsApp } = useDashboardExports();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ecarts">("all");

  const items = useMemo(() => all.filter((r) => {
    if (filter === "ecarts" && r.conforme) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [all, search, filter]);

  const totalOracleQty = all.reduce((a, r) => a + r.oracleQty, 0);
  const totalSapQty = all.reduce((a, r) => a + r.sapQty, 0);
  const totalOracleValue = all.reduce((a, r) => a + r.oracleValue, 0);
  const totalSapValue = all.reduce((a, r) => a + r.sapValue, 0);
  const ecartQtyGlobal = totalOracleQty - totalSapQty;
  const ecartValueGlobal = totalOracleValue - totalSapValue;
  const ecartCount = all.filter((r) => !r.conforme).length;

  if (loading && all.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const waSummary = [
    { label: "Oracle (Qty)", value: fmtNum(totalOracleQty) },
    { label: "SAP (Qty)", value: fmtNum(totalSapQty) },
    { label: "Écart qty", value: fmtNum(ecartQtyGlobal) },
    { label: "Écart valeur", value: fmtEur(ecartValueGlobal) },
    { label: "Écarts SKU", value: ecartCount },
  ];

  const good = ecartValueGlobal === 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Comparateur caisse"
        title="Caisse / Oracle"
        subtitle="Comparateur entre export Oracle (caisse) et SAP ventes — mise en évidence des écarts"
        actions={
          <>
            <ShareActions title="Caisse / Oracle" summary={waSummary} notify={notify} />
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      {/* Global comparator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-graphite-500 font-semibold mb-3">Quantités</p>
          <div className="space-y-3">
            <CompareRow label="Oracle (caisse)" value={fmtNum(totalOracleQty)} />
            <CompareRow label="SAP (ventes)" value={fmtNum(totalSapQty)} />
            <div className="pt-2 border-t border-graphite-100">
              <CompareRow
                label="Écart global"
                value={fmtNum(ecartQtyGlobal)}
                emphasis={ecartQtyGlobal !== 0}
                good={ecartQtyGlobal === 0}
              />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider text-graphite-500 font-semibold mb-3">Valeur</p>
          <div className="space-y-3">
            <CompareRow label="Oracle (caisse)" value={fmtEur(totalOracleValue)} />
            <CompareRow label="SAP (ventes)" value={fmtEur(totalSapValue)} />
            <div className="pt-2 border-t border-graphite-100">
              <CompareRow
                label="Écart global"
                value={fmtEur(ecartValueGlobal)}
                emphasis={ecartValueGlobal !== 0}
                good={ecartValueGlobal === 0}
              />
            </div>
          </div>
        </div>
        <div className={`card p-5 flex flex-col justify-center items-center text-center ${good ? "border-emerald-200 bg-emerald-50/30" : "border-rose-200 bg-rose-50/30"}`}>
          {good ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-emerald-700">Concordance parfaite</p>
              <p className="text-xs text-emerald-600 mt-1">Aucun écart détecté entre Oracle et SAP.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-rose-700">{ecartCount} écart(s) à investiguer</p>
              <p className="text-xs text-rose-600 mt-1">Différence valeur : {fmtEur(ecartValueGlobal)}</p>
            </>
          )}
        </div>
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="card p-1 flex gap-1">
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${filter === "all" ? "bg-graphite-900 text-white" : "text-graphite-600"}`}>Tous ({all.length})</button>
          <button onClick={() => setFilter("ecarts")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${filter === "ecarts" ? "bg-rose-600 text-white" : "text-graphite-600"}`}>Écarts uniquement ({ecartCount})</button>
        </div>
        <div className="flex gap-1.5 sm:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("oracle_vs_sap.csv", items as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("oracle_vs_sap.xlsx", items as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
          <button className="btn-dark text-sm" onClick={async () => { await copyWhatsApp("Caisse / Oracle", waSummary); notify("Résumé copié"); }}>WhatsApp</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<Receipt />} title="Aucune comparaison" description="Importez les fichiers Oracle du jour et SAP des ventes pour activer le comparateur." action={<button className="btn-primary" onClick={() => setView("import")}>Importer</button>} /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-right">Oracle Qty</th>
                  <th className="px-3 py-2.5 text-right">SAP Qty</th>
                  <th className="px-3 py-2.5 text-right">Oracle Valeur</th>
                  <th className="px-3 py-2.5 text-right">SAP Valeur</th>
                  <th className="px-3 py-2.5 text-right">Écart Qty</th>
                  <th className="px-3 py-2.5 text-right">Écart Valeur</th>
                  <th className="px-3 py-2.5 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.sku} className={r.conforme ? "" : r.risk === "action" ? "row-action" : "row-attention"}>
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.oracleQty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.sapQty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEur(r.oracleValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEur(r.sapValue)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.ecartQty === 0 ? "text-graphite-500" : "text-rose-700"}`}>{r.ecartQty > 0 ? "+" : ""}{fmtNum(r.ecartQty)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.ecartValue === 0 ? "text-graphite-500" : "text-rose-700"}`}>{r.ecartValue > 0 ? "+" : ""}{fmtEur(r.ecartValue)}</td>
                    <td className="px-3 py-2">
                      {r.conforme ? (
                        <span className="tag-ok"><CheckCircle2 className="h-3 w-3" /> Conforme</span>
                      ) : (
                        <span className="tag-action"><Scale className="h-3 w-3" /> À investiguer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label, value, emphasis, good,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-graphite-600">{label}</span>
      <span className={`tabular-nums font-semibold ${emphasis ? (good ? "text-emerald-700" : "text-rose-700") : "text-graphite-900"}`}>
        {value}
      </span>
    </div>
  );
}
