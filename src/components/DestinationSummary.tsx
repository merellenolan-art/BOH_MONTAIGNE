import type { DestinationZone } from "../types";
import type { NormalizedRow } from "../types";
import { groupByDestination } from "../lib/engine";
import { ZoneTag } from "./ui";
import { fmtNum } from "../lib/engine";

export interface DestinationSummary {
  rowsByZone: Map<DestinationZone, NormalizedRow[]>;
  total: number;
}

export function buildDestinationSummary(rows: NormalizedRow[]): DestinationSummary {
  const rowsByZone = groupByDestination(rows);
  const total = rows.reduce((a, r) => a + (r.quantity ?? 0), 0);
  return { rowsByZone, total };
}

const ZONE_ORDER: DestinationZone[] = ["France", "Europe", "Trecate"];

/** Compact destination breakdown card used by Home & Evening dashboards. */
export function DestinationSummaryCard({
  title,
  rows,
}: {
  title: string;
  rows: NormalizedRow[];
}) {
  const { rowsByZone, total } = buildDestinationSummary(rows);
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-graphite-900 mb-3">{title}</h3>
      <div className="space-y-2.5">
        {ZONE_ORDER.map((zone) => {
          const items = rowsByZone.get(zone) ?? [];
          const qty = items.reduce((a, r) => a + (r.quantity ?? 0), 0);
          const pct = total > 0 ? Math.round((qty / total) * 100) : 0;
          return (
            <div key={zone} className="flex items-center gap-3">
              <ZoneTag zone={zone} />
              <div className="flex-1 min-w-0">
                <div className="h-2 bg-graphite-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      zone === "France" ? "bg-house-500" : zone === "Europe" ? "bg-steel-400" : zone === "Trecate" ? "bg-amber-400" : "bg-graphite-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right tabular-nums w-20">
                <p className="text-sm font-semibold text-graphite-900">{fmtNum(qty)}</p>
                <p className="text-[10px] text-graphite-400">{pct}%</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 pt-3 border-t border-graphite-100 text-xs text-graphite-500">
        Total : <span className="font-semibold text-graphite-700 tabular-nums">{fmtNum(total)}</span> pièces
      </p>
    </div>
  );
}
