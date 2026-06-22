import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { MessageCircle, Mail, Camera, Share2, Loader2 } from "lucide-react";

export interface ShareKpi {
  label: string;
  value: string | number;
}

interface Props {
  dashboardName: string;
  kpis: ShareKpi[];
  alerts?: string[];
  /** Ref of the dashboard root to capture. Falls back to the ShareDashboard parent. */
  captureRef?: React.RefObject<HTMLElement | null>;
  notify?: (m: string) => void;
}

function buildSummary(name: string, kpis: ShareKpi[], alerts: string[]): string {
  const now = new Date().toLocaleString("fr-FR", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const lines: string[] = [];
  lines.push(`*${name}*`);
  lines.push(`${now}`);
  lines.push("");
  for (const k of kpis) lines.push(`• ${k.label}: ${k.value}`);
  if (alerts.length > 0) {
    lines.push("");
    lines.push("*Alertes*");
    for (const a of alerts) lines.push(`• ${a}`);
  }
  return lines.join("\n");
}

function canShareFiles(): boolean {
  return typeof navigator !== "undefined" && "canShare" in navigator && "share" in navigator;
}

export function ShareDashboard({ dashboardName, kpis, alerts = [], captureRef, notify }: Props) {
  const selfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const summary = buildSummary(dashboardName, kpis, alerts);

  const handleWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [summary]);

  const handleEmail = useCallback(() => {
    const subject = `${dashboardName} — ${new Date().toLocaleDateString("fr-FR")}`;
    const body = summary;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [dashboardName, summary]);

  const capture = useCallback(async (): Promise<Blob | null> => {
    const node = captureRef?.current ?? selfRef.current?.parentElement;
    if (!node) return null;
    const dataUrl = await toPng(node, {
      backgroundColor: "#17181B",
      pixelRatio: 2,
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  }, [captureRef]);

  const handleCapture = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await capture();
      if (!blob) {
        notify?.("Capture impossible");
        return;
      }
      const file = new File([blob], `${dashboardName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

      if (canShareFiles() && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: summary });
        notify?.("Dashboard partagé");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      notify?.("Capture téléchargée (PNG)");
    } catch {
      notify?.("Capture annulée");
    } finally {
      setBusy(false);
    }
  }, [capture, summary, dashboardName, notify]);

  return (
    <div ref={selfRef} className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="h-4 w-4 text-graphite-500" />
        <h3 className="text-sm font-semibold text-graphite-900">Partager ce dashboard</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost text-sm" onClick={handleWhatsApp} title="Résumé WhatsApp">
          <MessageCircle className="h-4 w-4 text-emerald-400" /> WhatsApp
        </button>
        <button className="btn-ghost text-sm" onClick={handleEmail} title="Envoyer par e-mail">
          <Mail className="h-4 w-4 text-steel-400" /> E-mail
        </button>
        <button className="btn-ghost text-sm" onClick={handleCapture} disabled={busy} title="Capturer le dashboard">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-house-400" />}
          {busy ? "Capture…" : "Capturer"}
        </button>
      </div>
      {!canShareFiles() && (
        <p className="mt-2 text-[11px] text-graphite-400">
          Le partage direct de fichier n'est pas supporté par ce navigateur : la capture sera téléchargée.
        </p>
      )}
    </div>
  );
}
