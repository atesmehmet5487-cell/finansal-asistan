"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ScoreGauge from "@/components/ScoreGauge";
import PriceCard from "@/components/PriceCard";
import NewsCard from "@/components/NewsCard";
import TechnicalPanel from "@/components/TechnicalPanel";
import SentimentPanel from "@/components/SentimentPanel";
import TradingChart from "@/components/TradingChart";
import CommentCard from "@/components/CommentCard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ArrowLeft, Bell, TrendingUp, Newspaper, Users } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "teknik" | "haberler" | "yorumlar";

export default function AssetPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();

  const [data, setData] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("teknik");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const { lastMessage } = useWebSocket(`${API.replace("http", "ws")}/ws/live`);

  useEffect(() => {
    try {
      setWatchlist(JSON.parse(localStorage.getItem("watchlist") || "[]"));
    } catch { setWatchlist([]); }
  }, []);

  const isWatching = watchlist.includes(symbol);

  const toggleWatch = () => {
    setWatchlist(prev => {
      const next = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
      localStorage.setItem("watchlist", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assetRes, newsRes] = await Promise.all([
          fetch(`${API}/api/v1/assets/${symbol}`).then(r => r.json()),
          fetch(`${API}/api/v1/assets/${symbol}/news?limit=20`).then(r => r.json()),
        ]);
        setData(assetRes);
        setNews(newsRes.news || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "PRICE_UPDATE" && lastMessage.symbol === symbol) {
      setData((prev: any) => prev ? { ...prev, price: lastMessage.data } : prev);
    }
    if (lastMessage.type === "ANALYSIS_UPDATE" && lastMessage.symbol === symbol) {
      setData((prev: any) => prev ? { ...prev, consolidated: lastMessage.data } : prev);
    }
  }, [lastMessage, symbol]);

  if (loading) return <PageSkeleton />;
  if (!data) return (
    <div className="text-center py-20 text-text-secondary">
      {symbol} bulunamadı.
    </div>
  );

  const { price, technical, sentiment, consolidated } = data;
  const comments = sentiment?.top_comments || [];

  return (
    <div className="space-y-6" style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 0" }}>
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{symbol}</h1>
            <p className="text-text-secondary text-sm">BIST</p>
          </div>
        </div>
        <button
          onClick={toggleWatch}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm ${
            isWatching
              ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5"
              : "border-border text-text-secondary hover:border-accent-cyan hover:text-accent-cyan"
          }`}
        >
          <Bell className="w-4 h-4" />
          {isWatching ? "İzlemeden Çıkar" : "İzlemeye Ekle"}
        </button>
      </div>

      {/* Fiyat + Skor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 card card-glow">
          {price && (
            <PriceCard
              price={price.price}
              changePct={price.change_pct}
              volume={price.volume}
            />
          )}
        </div>
        <div className="card card-glow flex flex-col items-center justify-center">
          {consolidated ? (
            <>
              <ScoreGauge score={consolidated.composite_score} size="lg" />
              <div className="text-center mt-3">
                <div className="text-xs text-text-secondary">Genel Görünüm</div>
                <div className="text-sm font-medium mt-1">
                  <SentimentBadge sentiment={consolidated.overall_sentiment} />
                </div>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">Analiz bekleniyor...</div>
          )}
        </div>
      </div>

      {/* Özet */}
      {consolidated?.summary_tr && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="card border-l-2 border-accent-cyan"
        >
          <p className="text-text-secondary text-sm leading-relaxed">{consolidated.summary_tr}</p>
          {consolidated.key_points?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {consolidated.key_points.map((point: string, i: number) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                  <span className="text-accent-cyan mt-0.5">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* Chart */}
      <div className="card card-glow">
        <TradingChart symbol={symbol} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary p-1 rounded-lg border border-border">
        {([
          { key: "teknik", label: "Teknik Analiz", icon: TrendingUp },
          { key: "haberler", label: "Haberler", icon: Newspaper },
          { key: "yorumlar", label: "Yatırımcı Yorumları", icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-md text-sm transition-all ${
              activeTab === key
                ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab İçeriği */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "teknik" && technical && (
            <TechnicalPanel data={technical} />
          )}
          {activeTab === "haberler" && (
            <div className="space-y-3">
              {news.length === 0 ? (
                <div className="card text-center py-10 text-text-secondary text-sm">
                  {symbol} için şu an haber bulunmuyor.
                </div>
              ) : (
                news.map((item, i) => <NewsCard key={i} news={item} />)
              )}
            </div>
          )}
          {activeTab === "yorumlar" && (
            <div className="space-y-3">
              {sentiment && <SentimentPanel data={sentiment} />}
              {comments.length === 0 ? (
                <div className="card text-center py-10 text-text-secondary text-sm">
                  Yatırımcı yorumu bulunamadı.
                </div>
              ) : (
                comments.map((comment: any, i: number) => (
                  <CommentCard key={i} comment={comment} />
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Disclaimer */}
      <div className="text-center text-text-muted text-xs py-4 border-t border-border">
        Bu analiz bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir.
        Finansal kararlarınız için profesyonel danışmana başvurunuz.
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; color: string }> = {
    STRONGLY_POSITIVE: { label: "Güçlü Pozitif", color: "text-positive" },
    POSITIVE: { label: "Pozitif", color: "text-positive" },
    NEUTRAL: { label: "Nötr", color: "text-neutral-gold" },
    NEGATIVE: { label: "Negatif", color: "text-negative" },
    STRONGLY_NEGATIVE: { label: "Güçlü Negatif", color: "text-negative" },
  };
  const info = map[sentiment] || { label: sentiment, color: "text-text-secondary" };
  return <span className={info.color}>{info.label}</span>;
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-border rounded w-32" />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card h-32" />
        <div className="card h-32" />
      </div>
      <div className="card h-20" />
      <div className="card h-64" />
    </div>
  );
}
