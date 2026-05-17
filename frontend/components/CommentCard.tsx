"use client";
import { ExternalLink, Twitter, MessageSquare } from "lucide-react";

interface Props {
  comment: {
    source?: string;
    content?: string;
    author?: string;
    engagement_score?: number;
    sentiment?: string;
    url?: string;
  };
}

const sentimentConfig: Record<string, { color: string; label: string }> = {
  BULLISH: { color: "text-positive", label: "Boğa" },
  BEARISH: { color: "text-negative", label: "Ayı" },
  NEUTRAL: { color: "text-neutral-gold", label: "Nötr" },
};

export default function CommentCard({ comment }: Props) {
  const cfg = sentimentConfig[comment.sentiment || ""] || { color: "text-text-muted", label: "" };
  const SourceIcon = comment.source === "twitter" ? Twitter : MessageSquare;

  return (
    <div className="card hover:border-border-accent transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SourceIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-xs text-text-muted">@{comment.author}</span>
            {comment.engagement_score != null && (
              <span className="text-xs text-text-muted ml-auto">
                ♥ {Math.round(comment.engagement_score)}
              </span>
            )}
          </div>

          <p className="text-sm text-text-primary leading-relaxed">
            {comment.content}
          </p>

          <div className="flex items-center gap-3 mt-2">
            {cfg.label && (
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            )}
            {comment.url && (
              <a
                href={comment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-text-muted hover:text-accent-cyan transition-colors ml-auto"
              >
                <ExternalLink className="w-3 h-3" />
                Görüntüle
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
