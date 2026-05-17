"use client";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MacroItem {
  value: number | null;
  name: string;
  unit: string;
}

interface MacroSummary {
  policy_rate: MacroItem;
  cpi_yearly: MacroItem;
  cpi_monthly: MacroItem;
  usd: MacroItem;
  eur: MacroItem;
  gross_reserves: MacroItem;
  exports: MacroItem;
  imports: MacroItem;
}

function fmt(val: number | null, unit: string): string {
  if (val === null || val === undefined) return "—";
  if (unit === "Mn $") return val.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  return val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MacroTile({ item, highlight }: { item: MacroItem; highlight?: "positive" | "negative" | "neutral" }) {
  const colorMap = {
    positive: "text-positive",
    negative: "text-negative",
    neutral: "text-neutral-gold",
  };
  const color = highlight ? colorMap[highlight] : "text-text-primary";

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs text-text-secondary truncate">{item.name}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {fmt(item.value, item.unit)}{item.value !== null ? ` ${item.unit}` : ""}
      </span>
    </div>
  );
}

export default function MacroPanel() {
  const [data, setData] = useState<MacroSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/macro/summary`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    const interval = setInterval(() => {
      fetch(`${API}/api/v1/macro/summary`)
        .then(r => r.json())
        .then(d => setData(d))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-border rounded w-32 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-border rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tradeBalance = (data.exports.value ?? 0) - (data.imports.value ?? 0);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-accent-cyan" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          TCMB Makroekonomik Göstergeler
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
        <MacroTile item={data.policy_rate} highlight="neutral" />
        <MacroTile item={data.cpi_yearly} highlight="negative" />
        <MacroTile item={data.usd} />
        <MacroTile item={data.eur} />
        <MacroTile item={data.cpi_monthly} />
        <MacroTile item={data.gross_reserves} highlight="positive" />
        <MacroTile item={data.exports} />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs text-text-secondary truncate">Dış Ticaret Dengesi</span>
          <span className={`text-sm font-semibold tabular-nums flex items-center gap-1 ${tradeBalance >= 0 ? "text-positive" : "text-negative"}`}>
            {tradeBalance >= 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            {Math.abs(tradeBalance).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} Mn $
          </span>
        </div>
      </div>
    </div>
  );
}
