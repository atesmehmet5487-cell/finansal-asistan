"use client";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, AlertCircle, Info, Minus } from "lucide-react";

interface Props {
  news: {
    title: string;
    source?: string;
    published_at?: string;
    sentiment_label?: string;
    importance?: string;
    summary_tr?: string;
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

export default function NewsCard({ news }: Props) {
  const cfg = importanceConfig[news.importance as keyof typeof importanceConfig] || importanceConfig.LOW;
  const { Icon, color, bg, label } = cfg;

  let timeAgo = "";
  if (news.published_at) {
    try {
      timeAgo = formatDistanceToNow(new Date(news.published_at), { addSuffix: true, locale: tr });
    } catch {}
  }

  return (
    <a
      href={news.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block card border ${bg} hover:border-opacity-60 transition-all duration-200 group`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {label && (
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            )}
            {news.sentiment_label && (
              <span className={`text-xs ${sentimentColor[news.sentiment_label] || "text-text-muted"}`}>
                {news.sentiment_label === "POSITIVE" ? "▲ Olumlu"
                  : news.sentiment_label === "NEGATIVE" ? "▼ Olumsuz"
                  : "→ Nötr"}
              </span>
            )}
          </div>

          <h3 className="text-sm font-medium text-text-primary line-clamp-2 group-hover:text-accent-cyan transition-colors">
            {news.title}
          </h3>

          {news.summary_tr && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
              {news.summary_tr}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            {news.source && <span>{news.source}</span>}
            {timeAgo && <span>{timeAgo}</span>}
            {news.affected_assets?.length > 0 && (
              <div className="flex gap-1">
                {news.affected_assets.slice(0, 3).map(a => (
                  <span key={a} className="px-1.5 py-0.5 bg-accent-cyan/10 text-accent-cyan rounded text-[10px] font-mono">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
