import { MessageCircle, Mail } from "lucide-react";
import { buildWhatsAppSummary } from "../lib/engine";

/**
 * Discrete share actions shown in every dashboard header.
 * Builds an anonymized summary (title + date + KPI lines) and opens a
 * pre-filled WhatsApp message or email draft. Client data is never included —
 * only aggregate counts and amounts that the caller passes in.
 */
export function ShareActions({
  title,
  summary,
  notify,
}: {
  title: string;
  summary: { label: string; value: string | number }[];
  notify?: (m: string) => void;
}) {
  const dateStr = new Date().toLocaleDateString("fr-FR");

  function openWhatsApp() {
    const text = buildWhatsAppSummary(title, summary);
    // wa.me opens the WhatsApp app/web with the message pre-filled. No phone
    // number is specified so the user picks the recipient themselves.
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    notify?.("Résumé WhatsApp ouvert dans un nouvel onglet");
  }

  function openEmail() {
    const subject = `${title} — ${dateStr}`;
    const body = buildWhatsAppSummary(title, summary);
    // mailto: opens the user's default mail client with a pre-filled draft.
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    notify?.("Brouillon e-mail ouvert dans votre client de messagerie");
  }

  return (
    <div className="card p-1 flex gap-1">
      <button
        onClick={openWhatsApp}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-graphite-700 hover:bg-graphite-900 hover:text-white transition-colors"
        title="Envoyer un résumé par WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </button>
      <button
        onClick={openEmail}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-graphite-700 hover:bg-graphite-900 hover:text-white transition-colors"
        title="Envoyer un résumé par e-mail"
      >
        <Mail className="h-3.5 w-3.5" /> E-mail
      </button>
    </div>
  );
}
