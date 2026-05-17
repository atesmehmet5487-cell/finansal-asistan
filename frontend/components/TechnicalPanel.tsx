"use client";

interface Props {
  data: any;
}

type Signal = "BUY" | "SELL" | "NEUTRAL" | "BULLISH" | "BEARISH" | "OVERBOUGHT" | "OVERSOLD" | string;

const signalConfig: Record<Signal, { label: string; color: string; bg: string }> = {
  BUY: { label: "Al Sinyali", color: "text-positive", bg: "bg-positive/10" },
  BULLISH: { label: "Yükseliş", color: "text-positive", bg: "bg-positive/10" },
  NEUTRAL: { label: "Nötr", color: "text-neutral-gold", bg: "bg-neutral-gold/10" },
  SELL: { label: "Sat Sinyali", color: "text-negative", bg: "bg-negative/10" },
  BEARISH: { label: "Düşüş", color: "text-negative", bg: "bg-negative/10" },
  OVERBOUGHT: { label: "Aşırı Alım", color: "text-negative", bg: "bg-negative/10" },
  OVERSOLD: { label: "Aşırı Satım", color: "text-positive", bg: "bg-positive/10" },
};

function SignalBadge({ signal }: { signal?: string }) {
  const cfg = signalConfig[signal || ""] || { label: signal || "—", color: "text-text-muted", bg: "bg-bg-secondary" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function IndicatorRow({ name, value, signal, note }: { name: string; value?: number | null; signal?: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div>
        <div className="text-sm text-text-primary font-medium">{name}</div>
        {note && <div className="text-xs text-text-secondary mt-0.5">{note}</div>}
      </div>
      <div className="flex items-center gap-3">
        {value != null && (
          <span className="font-mono text-sm text-text-secondary">
            {typeof value === "number" ? value.toFixed(2) : value}
          </span>
        )}
        <SignalBadge signal={signal} />
      </div>
    </div>
  );
}

function LevelRow({ label, value, type }: { label: string; value?: number | null; type: "resistance" | "support" | "pivot" }) {
  const colors = {
    resistance: "text-negative",
    support: "text-positive",
    pivot: "text-accent-cyan",
  };
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`font-mono text-sm font-medium ${colors[type]}`}>
        {value != null ? value.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "—"}
      </span>
    </div>
  );
}

export default function TechnicalPanel({ data }: Props) {
  const { indicators, levels, trend, composite_signal, confidence, interpretation_tr } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Sol: İndikatörler */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            İndikatörler
          </h3>
          <div className="flex items-center gap-2">
            <SignalBadge signal={composite_signal} />
            {confidence && (
              <span className="text-xs text-text-muted">
                %{(confidence * 100).toFixed(0)} güven
              </span>
            )}
          </div>
        </div>

        <div>
          {indicators?.RSI_14 && (
            <IndicatorRow
              name="RSI (14)"
              value={indicators.RSI_14.value}
              signal={indicators.RSI_14.signal}
              note={indicators.RSI_14.note}
            />
          )}
          {indicators?.MACD && (
            <IndicatorRow
              name="MACD (12,26,9)"
              value={indicators.MACD.value}
              signal={indicators.MACD.signal}
            />
          )}
          {indicators?.MA20 && (
            <IndicatorRow
              name="MA 20"
              value={indicators.MA20.value}
              signal={indicators.MA20.signal}
              note={indicators.MA20.note}
            />
          )}
          {indicators?.MA50 && (
            <IndicatorRow
              name="MA 50"
              value={indicators.MA50.value}
              signal={indicators.MA50.signal}
              note={indicators.MA50.note}
            />
          )}
          {indicators?.Bollinger && (
            <IndicatorRow
              name="Bollinger Bands"
              signal={indicators.Bollinger.signal}
              note={`Pozisyon: ${indicators.Bollinger.position}`}
            />
          )}
          {indicators?.Stochastic && (
            <IndicatorRow
              name="Stochastic"
              value={indicators.Stochastic.k}
              signal={indicators.Stochastic.signal}
            />
          )}
        </div>

        {interpretation_tr && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-text-secondary leading-relaxed">{interpretation_tr}</p>
          </div>
        )}
      </div>

      {/* Sağ: Seviyeler + Trend */}
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Destek & Direnç
          </h3>
          {levels && (
            <div>
              <LevelRow label="Direnç 2" value={levels.resistance_2} type="resistance" />
              <LevelRow label="Direnç 1" value={levels.resistance_1} type="resistance" />
              <LevelRow label="Pivot" value={levels.pivot} type="pivot" />
              <LevelRow label="Destek 1" value={levels.support_1} type="support" />
              <LevelRow label="Destek 2" value={levels.support_2} type="support" />
            </div>
          )}
        </div>

        {trend && (
          <div className="card">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Trend Durumu
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Yön</span>
              <span className={`text-sm font-medium ${
                trend.direction === "UPTREND" ? "text-positive"
                : trend.direction === "DOWNTREND" ? "text-negative"
                : "text-neutral-gold"
              }`}>
                {trend.direction === "UPTREND" ? "▲ Yükseliş"
                  : trend.direction === "DOWNTREND" ? "▼ Düşüş"
                  : "→ Yatay"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-text-secondary">Güç</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-cyan rounded-full"
                    style={{ width: `${(trend.strength || 0) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-text-muted">
                  %{((trend.strength || 0) * 100).toFixed(0)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-text-secondary">Al/Sat Oranı</span>
              <span className="text-xs font-mono text-text-muted">
                {trend.buy_signals}↑ / {trend.sell_signals}↓
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
