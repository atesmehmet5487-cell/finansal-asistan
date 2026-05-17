"use client";
import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

const OVERVIEW_SYMBOLS = ["BIST100", "DOLAR", "EURO", "ALTIN", "BTC"];
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PriceData {
  price?: number;
  change_pct?: number;
}

export default function MarketOverview() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const { lastMessage } = useWebSocket(`${API.replace("http", "ws")}/ws/live`);

  useEffect(() => {
    const fetchPrices = async () => {
      const results: Record<string, PriceData> = {};
      await Promise.all(
        OVERVIEW_SYMBOLS.map(async (sym) => {
          try {
            const res = await fetch(`${API}/api/v1/assets/${sym}`);
            if (res.ok) {
              const data = await res.json();
              results[sym] = data.price || {};
            }
          } catch {}
        })
      );
      setPrices(results);
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    if (lastMessage?.type === "PRICE_UPDATE" && lastMessage.symbol) {
      setPrices(prev => ({ ...prev, [lastMessage.symbol]: lastMessage.data }));
    }
  }, [lastMessage]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {OVERVIEW_SYMBOLS.map(symbol => {
        const data = prices[symbol];
        const change = data?.change_pct ?? 0;
        const isPos = change >= 0;

        return (
          <a key={symbol} href={`/${symbol}`} className="card hover:border-border-accent transition-all text-center group">
            <div className="text-xs text-text-muted mb-1">{symbol}</div>
            <div className="font-mono font-semibold text-text-primary text-sm group-hover:text-accent-cyan transition-colors">
              {data?.price != null
                ? data.price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "—"}
            </div>
            {data?.change_pct != null && (
              <div className={`text-xs font-mono mt-1 ${isPos ? "text-positive" : "text-negative"}`}>
                {isPos ? "+" : ""}{change.toFixed(2)}%
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}
