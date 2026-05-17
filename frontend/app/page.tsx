"use client";
import { useEffect, useState } from "react";
import MarketOverview from "@/components/MarketOverview";
import MacroPanel from "@/components/MacroPanel";
import NewsCard from "@/components/NewsCard";
import ScoreGauge from "@/components/ScoreGauge";
import PriceCard from "@/components/PriceCard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Activity, Zap, TrendingUp } from "lucide-react";

const FEATURED_SYMBOLS = ["ASELS", "THYAO", "GARAN", "AKBNK", "BIST100"];
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const [assets, setAssets] = useState<Record<string, any>>({});
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket(`${API.replace("http", "ws")}/ws/live`);

  useEffect(() => {
    let retries = 0;
    const fetchAll = async () => {
      try {
        const [newsRes, ...assetRes] = await Promise.all([
          fetch(`${API}/api/v1/news/feed?category=all&limit=20`).then(r => r.json()).catch(() => ({ news: [] })),
          ...FEATURED_SYMBOLS.map(s => fetch(`${API}/api/v1/assets/${s}`).then(r => r.ok ? r.json() : null).catch(() => null)),
        ]);

        setNews(newsRes.news || []);

        const assetMap: Record<string, any> = {};
        FEATURED_SYMBOLS.forEach((sym, i) => {
          if (assetRes[i]) assetMap[sym] = assetRes[i];
        });
        setAssets(assetMap);
        setLoading(false);
      } catch (e) {
        if (retries < 5) {
          retries++;
          setTimeout(fetchAll, 3000);
        } else {
          setLoading(false);
        }
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "PRICE_UPDATE" && lastMessage.symbol) {
      setAssets(prev => ({
        ...prev,
        [lastMessage.symbol]: {
          ...(prev[lastMessage.symbol] || {}),
          price: lastMessage.data,
        },
      }));
    }
  }, [lastMessage]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="text-accent-cyan w-6 h-6" />
            Finansal Asistan
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Türk borsası ve emtia gerçek zamanlı analiz platformu
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-positive">
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          Canlı
        </div>
      </div>

      {/* Market Overview */}
      <MarketOverview />

      {/* TCMB Macro Panel */}
      <MacroPanel />

      {/* Takip Edilen Varlıklar */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-cyan" />
          Öne Çıkan Varlıklar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_SYMBOLS.map(symbol => {
            const data = assets[symbol];
            if (!data && loading) return <AssetCardSkeleton key={symbol} />;
            if (!data) return null;

            const consolidated = data.consolidated;
            const price = data.price;

            return (
              <a
                key={symbol}
                href={`/${symbol}`}
                className="card card-glow hover:border-accent-cyan/30 transition-all duration-200 group block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold text-text-primary group-hover:text-accent-cyan transition-colors">
                      {symbol}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {symbol === "BIST100" ? "BIST 100 Endeksi" : "BIST"}
                    </div>
                  </div>
                  {consolidated && (
                    <ScoreGauge score={consolidated.composite_score} size="sm" />
                  )}
                </div>

                {price && (
                  <PriceCard
                    price={price.price}
                    changePct={price.change_pct}
                    compact
                  />
                )}

                {consolidated && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {consolidated.summary_tr}
                    </p>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      </section>

      {/* Breaking News */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-neutral-gold" />
          Son Haberler
        </h2>
        <div className="space-y-3">
          {news.length === 0 && loading && (
            <div className="card animate-pulse h-20" />
          )}
          {news.slice(0, 10).map((item, i) => (
            <NewsCard key={i} news={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AssetCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-border rounded w-16 mb-4" />
      <div className="h-8 bg-border rounded w-24" />
      <div className="h-4 bg-border rounded w-full mt-4" />
    </div>
  );
}
