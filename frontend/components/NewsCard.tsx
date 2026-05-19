"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, AlertCircle, Info, Minus, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  news: {
    title: string;
    source?: string;
    published_at?: string;
    sentiment_label?: string;
    importance?: string;
    summary_tr?: string;
    content?: string;
    url?: string;
    affected_assets?: string[];
  };
}

const importanceConfig = {
  CRITICAL: { Icon: AlertTriangle, color: "text-negative", bg: "bg-negative/10 border-negative/30", label: "Kritik" },
  HIGH: { Icon: AlertCircle, color: "text-neutral-gold", bg: "bg-neutral-gold/10 border-neutral-gold/30", label: "Önemli" },
  MEDIUM: { Icon: Info, color: "text-accent-cyan", bg: "bg-accent-cyan/5 border-accent-cyan/20", label: "Bilgi" },
  LOW: { Icon: Minus, color: "text-text-muted", bg: "bg-bg-secondary border-border", label: "" },
};

const sentimentColor: Record<string, string> = {
  POSITIVE: "text-positive",
  NEGATIVE: "text-negative",
  NEUTRAL: "text-text-secondary",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function NewsCard({ news }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = importanceConfig[news.importance as keyof typeof importanceConfig] || importanceConfig.LOW;
  const { Icon, color, bg, label } = cfg;

  let timeAgo = "";
  if (news.published_at) {
    try {
      timeAgo = formatDistanceToNow(new Date(news.published_at), { addSuffix: true, locale: tr });
    } catch {}
  }

  const bodyText = news.summary_tr || stripHtml(news.content || "");
  const hasBody = bodyText.length > 10;
  const hasUrl = !!news.url && news.url !== "#";

  const handleCardClick = () => {
    if (hasBody) {
      setExpanded(e => !e);
    } else if (hasUrl) {
      window.open(news.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`card border ${bg} transition-all duration-200 cursor-pointer select-none`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && handleCardClick()}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge satırı */}
          <div className="flex items-center gap-2 mb-1">
            {label && <span className={`text-xs font-medium ${color}`}>{label}</span>}
            {news.sentiment_label && (
              <span className={`text-xs ${sentimentColor[news.sentiment_label] || "text-text-muted"}`}>
                {news.sentiment_label === "POSITIVE" ? "▲ Olumlu"
                  : news.sentiment_label === "NEGATIVE" ? "▼ Olumsuz"
                  : "→ Nötr"}
              </span>
            )}
          </div>

          {/* Başlık */}
          <h3
            className="text-sm font-medium text-text-primary"
            style={expanded ? {} : {
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            } as React.CSSProperties}
          >
            {news.title}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted flex-wrap">
            {news.source && <span>{news.source}</span>}
            {timeAgo && <span>{timeAgo}</span>}
            {news.affected_assets && news.affected_assets.length > 0 && (
              <div className="flex gap-1">
                {news.affected_assets.slice(0, 4).map(a => (
                  <span key={a} className="px-1.5 py-0.5 bg-accent-cyan/10 text-accent-cyan rounded text-[10px] font-mono">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expand ikonu */}
        {hasBody && (
          <div className={`shrink-0 mt-1 opacity-50 ${color}`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </div>

      {/* Açılır içerik */}
      {expanded && hasBody && (
        <div className="mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {bodyText}
          </p>
          {hasUrl && (
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-accent-cyan hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Habere Git
            </a>
          )}
        </div>
      )}
    </div>
  );
}
