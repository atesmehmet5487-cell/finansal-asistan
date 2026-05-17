"use client";

interface Props {
  data: any;
}

export default function SentimentPanel({ data }: Props) {
  const { sentiment, total_mentions, trending_keywords, summary_tr } = data;
  const { bullish_pct = 0, bearish_pct = 0, neutral_pct = 0, overall, score } = sentiment || {};

  const sentimentLabel: Record<string, string> = {
    STRONGLY_BULLISH: "Güçlü Boğa",
    BULLISH: "Boğa",
    NEUTRAL: "Nötr",
    BEARISH: "Ayı",
    STRONGLY_BEARISH: "Güçlü Ayı",
  };

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Yatırımcı Duyarlılığı
        </h3>
        <div className="text-xs text-text-muted">
          {total_mentions?.toLocaleString("tr-TR")} yorum analiz edildi
        </div>
      </div>

      {/* Overall */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary text-sm">Genel Eğilim</span>
        <span className={`text-sm font-semibold ${
          (score || 0) > 0.3 ? "text-positive"
          : (score || 0) < -0.3 ? "text-negative"
          : "text-neutral-gold"
        }`}>
          {sentimentLabel[overall] || overall || "Nötr"}
        </span>
      </div>

      {/* Bar chart */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Boğa ({bullish_pct}%)</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-positive rounded-full transition-all duration-700"
              style={{ width: `${bullish_pct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Nötr ({neutral_pct}%)</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-gold rounded-full transition-all duration-700"
              style={{ width: `${neutral_pct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Ayı ({bearish_pct}%)</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-negative rounded-full transition-all duration-700"
              style={{ width: `${bearish_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Trending keywords */}
      {trending_keywords?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-text-muted mb-2">Öne Çıkan Konular</div>
          <div className="flex flex-wrap gap-2">
            {trending_keywords.map((kw: string, i: number) => (
              <span key={i} className="text-xs px-2 py-1 bg-accent-cyan/10 text-accent-cyan rounded-full border border-accent-cyan/20">
                #{kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary_tr && (
        <p className="mt-4 text-xs text-text-secondary leading-relaxed border-t border-border pt-3">
          {summary_tr}
        </p>
      )}
    </div>
  );
}
