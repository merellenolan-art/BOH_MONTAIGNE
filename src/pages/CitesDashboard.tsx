import { useMemo, useRef, useState } from "react";
import {
  Leaf, Printer, FileCheck, FileX, RefreshCw, Search, X, ShieldAlert,
} from "lucide-react";
import { SectionHeader, EmptyState, Spinner, KpiCard } from "../components/ui";
import { useDashboardExports } from "../lib/actions";
import { demoCites, fmtEur, fmtNum } from "../lib/engine";
import { upsertCitesItem } from "../lib/data";
import type { StoreState } from "../lib/useStore";
import type { CitesItem, DossierStatus } from "../types";
import { ShareDashboard } from "../components/ShareDashboard";

const STATUS_META: Record<DossierStatus, { label: string; cls: string }> = {
  todo: { label: "À faire", cls: "bg-rose-50 text-rose-700" },
  in_progress: { label: "En cours", cls: "bg-amber-50 text-amber-700" },
  complete: { label: "Complet", cls: "bg-emerald-50 text-emerald-700" },
  reexport_required: { label: "Réexportation requise", cls: "bg-rose-100 text-rose-800" },
};

export function CitesDashboard({
  store,
  notify,
}: {
  store: StoreState;
  notify: (m: string) => void;
}) {
  const { citesItems, loading, refresh } = store;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DossierStatus | "all">("all");
  const [signaletique, setSignaletique] = useState<CitesItem | null>(null);

  const all = useMemo(() => citesItems.length ? citesItems : demoCites(), [citesItems]);
  const captureRef = useRef<HTMLDivElement>(null);
  const { exportTable } = useDashboardExports();

  const items = useMemo(() => all.filter((c) => {
    if (statusFilter !== "all" && c.dossier_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.sku.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [all, search, statusFilter]);

  const totalPieces = all.reduce((a, c) => a + c.quantity, 0);
  const totalValue = all.reduce((a, c) => a + c.value, 0);
  const incomplete = all.filter((c) => c.dossier_status === "todo" || c.dossier_status === "reexport_required").length;
  const inProgress = all.filter((c) => c.dossier_status === "in_progress").length;

  if (loading && all.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-graphite-500">
        <Spinner className="h-6 w-6" /> <span className="ml-2">Chargement…</span>
      </div>
    );
  }

  return (
    <div ref={captureRef} className="space-y-6">
      <SectionHeader
        eyebrow="Réglementation"
        title="CITES"
        subtitle="Suivi des produits soumis à réglementation et préparation des dossiers"
        actions={
          <button className="btn-ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pièces CITES en boutique" value={fmtNum(totalPieces)} sub={`${all.length} références`} accent="house" icon={<Leaf className="h-4 w-4" />} />
        <KpiCard label="Valeur totale" value={fmtEur(totalValue)} accent="graphite" icon={<ShieldAlert className="h-4 w-4" />} />
        <KpiCard label="Dossiers en cours" value={fmtNum(inProgress)} accent="amber" icon={<FileCheck className="h-4 w-4" />} />
        <KpiCard label="Incomplets / à surveiller" value={fmtNum(incomplete)} sub="Action requise" accent="rose" icon={<FileX className="h-4 w-4" />} />
      </div>

      {incomplete > 0 && (
        <div className="card p-3 border-rose-200 bg-rose-50/40 flex items-center gap-3">
          <FileX className="h-5 w-5 text-rose-600" />
          <p className="text-sm text-rose-800 font-medium flex-1">
            {incomplete} dossier(s) incomplet(s) ou en réexportation requise.
          </p>
        </div>
      )}

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
          <input className="input pl-9" placeholder="Rechercher SKU, description, emplacement…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DossierStatus | "all")}>
          <option value="all">Tous statuts</option>
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="complete">Complet</option>
          <option value="reexport_required">Réexportation requise</option>
        </select>
        <div className="flex gap-1.5 sm:ml-auto">
          <button className="btn-ghost text-sm" onClick={() => exportTable("cites.csv", items as unknown as Record<string, unknown>[], "csv")}>CSV</button>
          <button className="btn-ghost text-sm" onClick={() => exportTable("cites.xlsx", items as unknown as Record<string, unknown>[], "xlsx")}>Excel</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<Leaf />} title="Aucun produit CITES" description="Importez une extraction CITES pour démarrer." /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-right">Qté</th>
                  <th className="px-3 py-2.5 text-left">Emplacement</th>
                  <th className="px-3 py-2.5 text-right">Valeur</th>
                  <th className="px-3 py-2.5 text-left">Statut dossier</th>
                  <th className="px-3 py-2.5 text-center" title="Certificat CITES">Cert.</th>
                  <th className="px-3 py-2.5 text-center" title="Facture">Fact.</th>
                  <th className="px-3 py-2.5 text-center" title="Permis de réexportation">Réexp.</th>
                  <th className="px-3 py-2.5 text-center" title="Photo">Photo</th>
                  <th className="px-3 py-2.5 text-right">Fiche</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <CitesRow key={c.id} item={c} onSaved={() => store.refresh()} notify={notify} onPrint={() => setSignaletique(c)} real={citesItems.length > 0} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {signaletique && (
        <SignaletiqueModal item={signaletique} onClose={() => setSignaletique(null)} notify={notify} />
      )}
      <ShareDashboard
        dashboardName="CITES"
        kpis={[
          { label: "Pièces", value: fmtNum(totalPieces) },
          { label: "Valeur", value: fmtEur(totalValue) },
          { label: "En cours", value: fmtNum(inProgress) },
          { label: "Incomplets", value: fmtNum(incomplete) },
        ]}
        alerts={incomplete > 0 ? [`${incomplete} dossier(s) incomplet(s)`] : []}
        captureRef={captureRef}
        notify={notify}
      />
    </div>
  );
}

function CitesRow({
  item: c, onSaved, notify, onPrint, real,
}: {
  item: CitesItem;
  onSaved: () => void;
  notify: (m: string) => void;
  onPrint: () => void;
  real: boolean;
}) {
  async function toggle(field: "docs_certificate" | "docs_invoice" | "docs_export" | "docs_photo") {
    if (!real) { notify("Données de démonstration — importez un fichier CITES pour activer l'édition."); return; }
    try {
      await upsertCitesItem(c.id, { [field]: !c[field] });
      onSaved();
    } catch (e) {
      notify(`Erreur : ${e instanceof Error ? e.message : e}`);
    }
  }

  const sm = STATUS_META[c.dossier_status];
  return (
    <tr className={c.dossier_status === "todo" || c.dossier_status === "reexport_required" ? "row-action" : c.dossier_status === "in_progress" ? "row-attention" : ""}>
      <td className="px-3 py-2 font-mono text-xs">{c.sku}</td>
      <td className="px-3 py-2 font-medium">{c.description}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.quantity)}</td>
      <td className="px-3 py-2 text-xs">{c.location}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtEur(c.value)}</td>
      <td className="px-3 py-2"><span className={`tag ${sm.cls}`}>{sm.label}</span></td>
      <td className="px-3 py-2 text-center"><Checkbox checked={c.docs_certificate} onChange={() => toggle("docs_certificate")} /></td>
      <td className="px-3 py-2 text-center"><Checkbox checked={c.docs_invoice} onChange={() => toggle("docs_invoice")} /></td>
      <td className="px-3 py-2 text-center"><Checkbox checked={c.docs_export} onChange={() => toggle("docs_export")} /></td>
      <td className="px-3 py-2 text-center"><Checkbox checked={c.docs_photo} onChange={() => toggle("docs_photo")} /></td>
      <td className="px-3 py-2 text-right">
        <button className="btn-ghost text-xs px-2 py-1" onClick={onPrint} title="Fiche signalétique imprimable">
          <Printer className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        checked ? "bg-house-600 border-house-600 text-white" : "bg-white border-graphite-300 hover:border-graphite-400"
      }`}
      title={checked ? "Présent" : "Absent"}
    >
      {checked && <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-6" /></svg>}
    </button>
  );
}

function SignaletiqueModal({ item, onClose, notify }: { item: CitesItem; onClose: () => void; notify: (m: string) => void }) {
  const sm = STATUS_META[item.dossier_status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-graphite-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lift w-full max-w-md overflow-hidden animate-rise">
        <div className="px-5 py-3 border-b border-graphite-100 flex items-center justify-between bg-graphite-900 text-white">
          <h3 className="font-serif text-lg font-semibold">Signalétique CITES</h3>
          <button onClick={onClose} className="text-graphite-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5" id="signaletique-print">
          <div className="aspect-[4/3] bg-graphite-100 rounded-lg mb-4 flex items-center justify-center text-graphite-400">
            <Leaf className="h-10 w-10" />
          </div>
          <div className="space-y-2 text-sm">
            <Row label="SKU" value={item.sku} />
            <Row label="Description" value={item.description} />
            <Row label="Quantité" value={fmtNum(item.quantity)} />
            <Row label="Emplacement" value={item.location} />
            <Row label="Valeur" value={fmtEur(item.value)} />
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-wider text-graphite-500 font-semibold">Statut CITES</p>
              <span className={`tag mt-1 ${sm.cls}`}>{sm.label}</span>
            </div>
            <div className="pt-2 text-[10px] text-graphite-400 border-t border-graphite-100">
              Document à coller sur la boîte — BOH Montaigne · Gucci Montaigne
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-graphite-100 flex justify-end gap-2 bg-graphite-50">
          <button className="btn-ghost text-sm" onClick={onClose}>Fermer</button>
          <button
            className="btn-dark text-sm"
            onClick={() => {
              window.print();
              notify("Impression lancée");
            }}
          >
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-graphite-500 text-xs uppercase tracking-wider font-semibold">{label}</span>
      <span className="font-medium text-graphite-900 text-right">{value}</span>
    </div>
  );
}
