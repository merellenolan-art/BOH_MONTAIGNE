import type { ReactNode } from "react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && (
        <div className="mb-3 h-12 w-12 rounded-full bg-graphite-100 text-graphite-500 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-graphite-800">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-graphite-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function RiskTag({ level }: { level: "ok" | "attention" | "action" }) {
  if (level === "ok") return <span className="tag-ok">OK</span>;
  if (level === "attention") return <span className="tag-attention">Attention</span>;
  return <span className="tag-action">Action requise</span>;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = "graphite",
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "graphite" | "house" | "steel" | "emerald" | "amber" | "rose";
  icon?: ReactNode;
}) {
  const accentMap: Record<string, string> = {
    graphite: "bg-graphite-100 text-graphite-700",
    house: "bg-house-50 text-house-700",
    steel: "bg-steel-100 text-steel-600",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  const barMap: Record<string, string> = {
    graphite: "bg-graphite-400",
    house: "bg-house-500",
    steel: "bg-steel-400",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-graphite-500 truncate">{sub}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`absolute top-0 left-0 h-full w-1 ${barMap[accent]}`} />
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-graphite-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 animate-rise">
      <div className="flex items-center gap-3 bg-graphite-900 text-white px-4 py-3 rounded-lg shadow-lift max-w-sm">
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="text-graphite-300 hover:text-white text-sm">✕</button>
      </div>
    </div>
  );
}

/** A destination zone badge. */
export function ZoneTag({ zone }: { zone: "France" | "Europe" | "UK" | "Autre" }) {
  const map: Record<string, string> = {
    France: "bg-house-50 text-house-700",
    Europe: "bg-steel-100 text-steel-700",
    UK: "bg-graphite-100 text-graphite-700",
    Autre: "bg-graphite-100 text-graphite-500",
  };
  return <span className={`tag ${map[zone]}`}>{zone}</span>;
}
