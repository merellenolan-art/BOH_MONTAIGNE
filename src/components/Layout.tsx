import { type ReactNode } from "react";
import {
  Home,
  Sunrise,
  Package,
  Moon,
  Leaf,
  Truck,
  ShoppingBag,
  Receipt,
  Upload,
} from "lucide-react";
import { Monogram } from "./Logo";
import { Toast } from "./ui";

export type View =
  | "home"
  | "morning"
  | "packaging"
  | "evening"
  | "cites"
  | "expeditions"
  | "mao"
  | "oracle"
  | "import";

const NAV: { id: View; label: string; icon: typeof Home; group: "Pilotage" | "Flux" | "Données"; hint: string }[] = [
  { id: "home", label: "Home", icon: Home, group: "Pilotage", hint: "Centre de pilotage" },
  { id: "morning", label: "Morning", icon: Sunrise, group: "Pilotage", hint: "Stock & transit" },
  { id: "packaging", label: "Packaging", icon: Package, group: "Pilotage", hint: "Bibliothèque packaging" },
  { id: "evening", label: "Evening", icon: Moon, group: "Pilotage", hint: "Clôture de journée" },
  { id: "cites", label: "CITES", icon: Leaf, group: "Flux", hint: "Réglementation" },
  { id: "expeditions", label: "Expéditions", icon: Truck, group: "Flux", hint: "FastShipment" },
  { id: "mao", label: "E-commerce / MAO", icon: ShoppingBag, group: "Flux", hint: "Commandes web" },
  { id: "oracle", label: "Caisse / Oracle", icon: Receipt, group: "Flux", hint: "Oracle vs SAP" },
  { id: "import", label: "Import Center", icon: Upload, group: "Données", hint: "Import des fichiers" },
];

const GROUPS = ["Pilotage", "Flux", "Données"] as const;

export function Layout({
  view,
  setView,
  children,
  lastUpdated,
  importCount,
  toast,
  setToast,
}: {
  view: View;
  setView: (v: View) => void;
  children: ReactNode;
  lastUpdated: Date | null;
  importCount: number;
  toast: string | null;
  setToast: (m: string | null) => void;
}) {
  const now = new Date();
  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-graphite-950 text-graphite-500 sticky top-0 h-screen border-r border-graphite-200">
        <div className="flex items-center px-5 h-16 border-b border-graphite-200">
          <p className="font-serif text-lg font-semibold tracking-wide text-graphite-900">BOH Montaigne</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {GROUPS.map((group) => (
            <div key={group} className="mb-3">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-graphite-400 font-semibold">
                {group}
              </p>
              {NAV.filter((n) => n.group === group).map((n) => {
                const active = view === n.id;
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setView(n.id)}
                    title={n.hint}
                    className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                      transition-all duration-150 ${
                        active
                          ? "bg-house-500 text-white shadow-soft"
                          : "text-graphite-500 hover:bg-graphite-100 hover:text-graphite-900"
                      }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-graphite-400 group-hover:text-house-400"}`} />
                    <span className="flex-1 text-left truncate">{n.label}</span>
                    {n.id === "import" && importCount > 0 && (
                      <span className="tag bg-house-500 text-white px-1.5 py-0">{importCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-graphite-200 text-xs text-graphite-400">
          <div className="flex items-center gap-2 mb-1">
            <Monogram className="h-4 w-4" />
            <span className="text-house-400 font-medium tracking-wide">INTERNE · CONFIDENTIEL</span>
          </div>
          {lastUpdated ? (
            <p>Dernier import&nbsp;: {lastUpdated.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</p>
          ) : (
            <p>Aucune importation</p>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-graphite-950 text-graphite-900 px-4 h-14 flex items-center gap-3 shadow-soft border-b border-graphite-200">
          <span className="font-serif text-base font-semibold flex-1 truncate text-graphite-900">BOH Montaigne</span>
        </header>
        <nav className="lg:hidden sticky top-14 z-30 bg-graphite-950 border-b border-graphite-200 overflow-x-auto scrollbar-thin">
          <div className="flex gap-1 p-2 min-w-max">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    active ? "bg-house-500 text-white" : "text-graphite-500 hover:bg-graphite-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
          </div>
        </nav>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
        <footer className="px-6 py-4 text-xs text-graphite-400 border-t border-graphite-200 bg-graphite-950">
          {now.getFullYear()} · BOH Montaigne — Tableau de bord opérationnel back of house · Usage interne
        </footer>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
