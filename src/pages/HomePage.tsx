import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Package, Truck, Sparkles, ShoppingCart, SlidersHorizontal, ArrowDownToLine,
  ArrowUpFromLine, Repeat, CalendarClock, Send, Zap, RefreshCw, Upload,
  Pencil, Check, AlertCircle, Activity,
} from "lucide-react";
import { SectionHeader, KpiCard, Spinner, RiskTag } from "../components/ui";
import { FilterBar, filterRows, sumField, useFilters } from "../components/dashboard";
import { ShareActions } from "../components/ShareActions";
import { DestinationSummaryCard } from "../components/DestinationSummary";
import type { View } from "../components/Layout";
import type { StoreState } from "../lib/useStore";
import { useViewSummary } from "../lib/useStore";
import { upsertDeptNote, upsertKpi } from "../lib/data";
import {
  fmtEur, fmtNum, fmtPct, demoTransit, demoEveningFlows,
} from "../lib/engine";
import type { DeptSummaryRow, KpiOverride, NormalizedRow } from "../types";

const RISK_COLOR: Record<string, string> = { ok: "#5f8a6c", attention: "#bd9229", action: "#b91c1c" };

export function HomePage({
  store,
  setView,
  notify,
}: {
  store: StoreState;
  setView: (v: View) => void;
  notify: (m: string) => void;
}) {
  const { imports, loading, lastUpdated, refresh } = store;
  const summary = useViewSummary(store);
  const { filter, ...setters } = useFilters();
  const rows = useMemo(() => filterRows(summary, filter), [summary, filter]);

  if (loading && summary.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  const stockTotal = sumField(summary, "stock_qty");
  const transitTotal = sumField(summary, "transit_qty");
  const newnessTotal = sumField(summary, "newness_qty");
  const salesQty = sumField(summary, "sales_qty");
  const salesValue = sumField(summary, "sales_value");
  const varianceQty = sumField(summary, "adjust_qty");
  const varianceValue = sumField(summary, "adjust_value");
  const inboundTotal = sumField(summary, "inbound_qty");
  const outboundTotal = sumField(summary, "outbound_qty");
  const consignmentTotal = sumField(summary, "consignment_qty");
  const reservationsTotal = sumField(summary, "reservations_qty");
  const expressTotal = summary.reduce((a, r) => a + r.fast_open, 0);
  const expeditionsTotal = sumField(summary, "expeditions_qty");
  const riskTodo = summary.filter((r) => r.risk === "action").length;
  const riskAttention = summary.filter((r) => r.risk === "attention").length;
  const hasImports = imports.length > 0;

  const waSummary = [
    { label: "Stock OH", value: fmtNum(stockTotal) },
    { label: "Transit", value: fmtNum(transitTotal) },
    { label: "Newness", value: fmtNum(newnessTotal) },
    { label: "Sales Qty", value: fmtNum(salesQty) },
    { label: "Sales Value", value: fmtEur(salesValue) },
    { label: "Variance Qty", value: fmtNum(varianceQty) },
    { label: "Express (FAST)", value: fmtNum(expressTotal) },
    { label: "Expéditions", value: fmtNum(expeditionsTotal) },
    { label: "Départements à risque", value: riskTodo },
  ];

  // Demo transit + evening flows feed the destination summary cards.
  const transitRows: NormalizedRow[] = useMemo(() =>
    demoTransit().map((t) => ({
      deptId: "", deptName: "",
      quantity: t.qty, destination: t.destination,
    })), []
  );
  const inboundRows: NormalizedRow[] = useMemo(() =>
    demoEveningFlows().filter((f) => f.type === "Réception").map((f) => ({
      deptId: "", deptName: "", quantity: f.qty, destination: f.destination,
    })), []
  );
  const outboundRows: NormalizedRow[] = useMemo(() =>
    demoEveningFlows().filter((f) => f.type === "Expédition").map((f) => ({
      deptId: "", deptName: "", quantity: f.qty, destination: f.destination,
    })), []
  );

  const chartData = useMemo(
    () => [...summary]
      .sort((a, b) => b.sales_value - a.sales_value)
      .slice(0, 14)
      .map((r) => ({ name: r.dept_id, stock: Math.round(r.stock_qty), salesValue: Math.round(r.sales_value), risk: r.risk })),
    [summary]
  );

  return (
    <div className="space-y-7">
      <SectionHeader
        title="Centre de pilotage"
        subtitle="Tableau de bord opérationnel Back of House — boutique Montaigne"
        eyebrow="BOH Montaigne"
        actions={
          <>
            <span className="text-xs text-graphite-500 hidden sm:inline">
              Dernier import : {lastUpdated ? lastUpdated.toLocaleString("fr-FR") : "—"}
            </span>
            <ShareActions title="BOH Montaigne — Centre de pilotage" summary={waSummary} notify={notify} />
            <button className="btn-ghost" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </>
        }
      />

      {/* Editable KPIs */}
      <KpiEditor kpis={store.kpis} notify={notify} onSaved={() => store.refresh()} hasImports={hasImports} />

      {/* Synthèse cards */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">Synthèse opérationnelle</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <KpiCard label="On-Hand total" value={fmtNum(stockTotal)} sub="Quantités en boutique" accent="graphite" icon={<Package className="h-4 w-4" />} />
          <KpiCard label="Transit" value={fmtNum(transitTotal)} sub="En cours d'acheminement" accent="steel" icon={<Truck className="h-4 w-4" />} />
          <KpiCard label="Newness" value={fmtNum(newnessTotal)} sub="Arrivages récents" accent="house" icon={<Sparkles className="h-4 w-4" />} />
          <KpiCard label="Ventes (Qty / Valeur)" value={fmtNum(salesQty)} sub={fmtEur(salesValue)} accent="house" icon={<ShoppingCart className="h-4 w-4" />} />
          <KpiCard label="Variances (Qty / Valeur)" value={fmtNum(varianceQty)} sub={fmtEur(varianceValue)} accent="rose" icon={<SlidersHorizontal className="h-4 w-4" />} />
          <KpiCard label="Inbound" value={fmtNum(inboundTotal)} sub="Réceptions" accent="house" icon={<ArrowDownToLine className="h-4 w-4" />} />
          <KpiCard label="Outbound" value={fmtNum(outboundTotal)} sub="Expéditions sortantes" accent="steel" icon={<ArrowUpFromLine className="h-4 w-4" />} />
          <KpiCard label="Consignments" value={fmtNum(consignmentTotal)} sub="Consignation SAP" accent="graphite" icon={<Repeat className="h-4 w-4" />} />
          <KpiCard label="Réservations" value={fmtNum(reservationsTotal)} sub="SAP reservations" accent="graphite" icon={<CalendarClock className="h-4 w-4" />} />
          <KpiCard label="Express (FAST)" value={fmtNum(expressTotal)} sub="Clienteling" accent="amber" icon={<Zap className="h-4 w-4" />} />
          <KpiCard label="Expéditions" value={fmtNum(expeditionsTotal)} sub="Logistique" accent="steel" icon={<Send className="h-4 w-4" />} />
          <KpiCard label="Runs (réalisés / à faire)" value={`${riskAttention}`} sub={`${riskTodo} à traiter`} accent="rose" icon={<Activity className="h-4 w-4" />} />
        </div>
      </div>

      {/* Destination summaries */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">Répartition par destination</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DestinationSummaryCard title="Transit par destination" rows={transitRows} />
          <DestinationSummaryCard title="Inbound par destination" rows={inboundRows} />
          <DestinationSummaryCard title="Outbound par destination" rows={outboundRows} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-graphite-900 mb-1">Stock par département</h3>
          <p className="text-xs text-graphite-500 mb-3">Quantité on-hand par département (top 14)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef1" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#677079" }} angle={-30} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11, fill: "#677079" }} />
              <Tooltip cursor={{ fill: "#f6f7f8" }} />
              <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={RISK_COLOR[d.risk] ?? RISK_COLOR.ok} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-graphite-900 mb-1">Valeur des ventes par département</h3>
          <p className="text-xs text-graphite-500 mb-3">Sales Value (€) — top 14</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef1" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#677079" }} angle={-30} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11, fill: "#677079" }} />
              <Tooltip cursor={{ fill: "#f6f7f8" }} formatter={(v) => fmtEur(Number(v))} />
              <Bar dataKey="salesValue" name="Sales Value" fill="#3a6a48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department table 100-945 */}
      <div>
        <h2 className="text-sm font-semibold text-graphite-700 mb-3 uppercase tracking-wider">Tableau des départements (100 → 945)</h2>
        <FilterBar
          filter={filter}
          setters={setters as unknown as Record<string, (v: string) => void>}
          departments={[...new Set(summary.map((r) => r.dept_id))].sort()}
          showStatus={false}
          showRisk
          exportName="boh_mountain_departements"
          rows={rows as unknown as Record<string, unknown>[]}
          waSummary={waSummary}
        />
        <div className="table-wrap mt-3">
          {!hasImports && (
            <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200/60 text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Données de démonstration anonymisées affichées tant qu'aucun fichier n'est importé.
              <button className="ml-auto text-amber-800 font-medium hover:underline" onClick={() => setView("import")}>
                Importer un fichier →
              </button>
            </div>
          )}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <Th>Département</Th>
                  <Th>Nom</Th>
                  <Th right>On-Hand</Th>
                  <Th right>Transit</Th>
                  <Th right>Newness</Th>
                  <Th right>Ventes Qty</Th>
                  <Th right>Ventes Valeur</Th>
                  <Th right>Variance Qty</Th>
                  <Th right>Variance Valeur</Th>
                  <Th right>Inbound</Th>
                  <Th right>Outbound</Th>
                  <Th right>Consign.</Th>
                  <Th right>Réserv.</Th>
                  <Th right>Express</Th>
                  <Th>Risque</Th>
                  <Th>Commentaire / Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <DeptTableRow key={r.dept_id} row={r} notify={notify} onSaved={() => store.refresh()} hasImports={hasImports} />
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={16} className="text-center text-graphite-400 py-8">Aucun département ne correspond aux filtres.</td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-graphite-50 font-semibold">
                    <td className="px-3 py-2.5" colSpan={2}>TOTAL</td>
                    <Td right strong>{fmtNum(sumField(rows, "stock_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "transit_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "newness_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "sales_qty"))}</Td>
                    <Td right strong>{fmtEur(sumField(rows, "sales_value"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "adjust_qty"))}</Td>
                    <Td right strong>{fmtEur(sumField(rows, "adjust_value"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "inbound_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "outbound_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "consignment_qty"))}</Td>
                    <Td right strong>{fmtNum(sumField(rows, "reservations_qty"))}</Td>
                    <Td right strong>{fmtNum(rows.reduce((a, r) => a + r.fast_open, 0))}</Td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {!hasImports && (
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-house-200 bg-house-50/30">
          <Upload className="h-5 w-5 text-house-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-graphite-800">Démarrez avec vos fichiers</p>
            <p className="text-xs text-graphite-500 mt-0.5">Importez vos extractions SAP, FAST, MAO et fichiers terrain depuis l'Import Center pour remplacer les données de démonstration.</p>
          </div>
          <button className="btn-house text-sm" onClick={() => setView("import")}>
            <Upload className="h-4 w-4" /> Import Center
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editable KPI editor                                                  */
/* ------------------------------------------------------------------ */

function KpiEditor({
  kpis,
  notify,
  onSaved,
  hasImports,
}: {
  kpis: KpiOverride[];
  notify: (m: string) => void;
  onSaved: () => void;
  hasImports: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Initialize draft from server values.
  useEffect(() => {
    const d: Record<string, string> = {};
    kpis.forEach((k) => { d[k.key] = String(k.value_numeric ?? 0); });
    setDraft(d);
  }, [kpis]);

  async function save(key: string) {
    setSaving(key);
    try {
      const value = parseFloat(draft[key] ?? "0") || 0;
      await upsertKpi(key, value);
      notify("KPI mis à jour");
      onSaved();
    } finally { setSaving(null); }
  }

  const format = (k: KpiOverride, raw: string) => {
    const v = parseFloat(raw) || 0;
    return k.unit === "EUR" ? fmtEur(v) : k.unit === "%" ? fmtPct(v) : fmtNum(v);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-graphite-900">Indicateurs clés</h3>
          <p className="text-xs text-graphite-500">Saisissez les valeurs manuellement — elles alimentent le tableau de bord.</p>
        </div>
        {!hasImports && <span className="tag-neutral text-[10px]">À compléter</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const raw = draft[k.key] ?? "0";
          return (
            <div key={k.key} className="border border-graphite-200 rounded-lg p-2.5 bg-graphite-50/40">
              <p className="text-[10px] uppercase tracking-wider text-graphite-500 font-semibold truncate">{k.label}</p>
              <p className="text-base font-semibold text-graphite-900 tabular-nums mt-0.5">{format(k, raw)}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <input
                  type="number"
                  value={raw}
                  onChange={(e) => setDraft((d) => ({ ...d, [k.key]: e.target.value }))}
                  className="input py-1 text-xs px-2"
                  placeholder="0"
                  step="0.01"
                />
                <button
                  onClick={() => save(k.key)}
                  disabled={saving === k.key}
                  className="btn-ghost px-2 py-1 text-xs"
                  title="Enregistrer"
                >
                  {saving === k.key ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Department table row (editable notes)                                */
/* ------------------------------------------------------------------ */

function DeptTableRow({
  row,
  notify,
  onSaved,
  hasImports,
}: {
  row: DeptSummaryRow;
  notify: (m: string) => void;
  onSaved: () => void;
  hasImports: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(row.action_taken || row.hypothesis);
  const [risk, setRisk] = useState(row.risk);
  const [saving, setSaving] = useState(false);
  void hasImports;
  void Pencil;

  async function save() {
    setSaving(true);
    try {
      // boh_department_summary stores hypothesis/action_taken columns; we also
      // mirror the comment into boh_dept_notes so it survives rebuilds.
      await upsertDeptNote(row.dept_id, { risk, comment });
      notify("Note département enregistrée");
      onSaved();
      setEditing(false);
    } finally { setSaving(false); }
  }

  const rowCls = row.risk === "action" ? "row-action" : row.risk === "attention" ? "row-attention" : "";

  return (
    <tr className={rowCls}>
      <td className="px-3 py-2 font-mono text-xs">{row.dept_id}</td>
      <td className="px-3 py-2 font-medium">{row.dept_name}</td>
      <Td right>{fmtNum(row.stock_qty)}</Td>
      <Td right>{fmtNum(row.transit_qty)}</Td>
      <Td right>{fmtNum(row.newness_qty)}</Td>
      <Td right>{fmtNum(row.sales_qty)}</Td>
      <Td right>{fmtEur(row.sales_value)}</Td>
      <Td right>{fmtNum(row.adjust_qty)}</Td>
      <Td right>{fmtEur(row.adjust_value)}</Td>
      <Td right>{fmtNum(row.inbound_qty)}</Td>
      <Td right>{fmtNum(row.outbound_qty)}</Td>
      <Td right>{fmtNum(row.consignment_qty)}</Td>
      <Td right>{fmtNum(row.reservations_qty)}</Td>
      <Td right>{fmtNum(row.fast_open)}</Td>
      <td className="px-3 py-2">
        {editing ? (
          <select value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)} className="select py-1 text-xs">
            <option value="ok">OK</option>
            <option value="attention">Attention</option>
            <option value="action">Action requise</option>
          </select>
        ) : (
          <RiskTag level={row.risk} />
        )}
      </td>
      <td className="px-3 py-2 max-w-[220px]">
        {editing ? (
          <input className="input py-1 text-xs" value={comment} onChange={(e) => setComment(e.target.value)} />
        ) : (
          <span className="text-xs text-graphite-600">{comment || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {editing ? (
          <button className="btn-house text-xs px-2 py-1" onClick={save} disabled={saving}>OK</button>
        ) : (
          <button className="btn-ghost text-xs px-2 py-1" onClick={() => setEditing(true)}>Éditer</button>
        )}
      </td>
    </tr>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2.5 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td className={`px-3 py-2 tabular-nums ${right ? "text-right" : "text-left"} ${strong ? "font-semibold text-graphite-900" : "text-graphite-700"}`}>
      {children}
    </td>
  );
}
