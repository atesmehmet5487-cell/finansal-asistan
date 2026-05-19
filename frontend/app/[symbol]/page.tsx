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

  // Fiyat alarmı
  const [alarmPrice, setAlarmPrice] = useState("");
  const [alarmDir, setAlarmDir] = useState<"above" | "below">("above");
  const [showAlarm, setShowAlarm] = useState(false);
  const [alarmSet, setAlarmSet] = useState(false);

  const saveAlarm = () => {
    const val = parseFloat(alarmPrice.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    const alarms = JSON.parse(localStorage.getItem("price_alarms") || "[]");
    alarms.push({ symbol, price: val, dir: alarmDir, createdAt: new Date().toISOString() });
    localStorage.setItem("price_alarms", JSON.stringify(alarms));
    setAlarmSet(true);
    setShowAlarm(false);
    setAlarmPrice("");
    // Browser notification izni iste
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
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

  // Fiyat değişince alarmları kontrol et
  useEffect(() => {
    const currentPrice = data?.price?.price;
    if (!currentPrice) return;
    try {
      const alarms: any[] = JSON.parse(localStorage.getItem("price_alarms") || "[]");
      const triggered = alarms.filter(a =>
        a.symbol === symbol &&
        ((a.dir === "above" && currentPrice >= a.price) ||
         (a.dir === "below" && currentPrice <= a.price))
      );
      if (triggered.length > 0 && "Notification" in window && Notification.permission === "granted") {
        triggered.forEach(a => {
          new Notification(`${symbol} Fiyat Alarmı`, {
            body: `${symbol} ${a.dir === "above" ? "▲" : "▼"} ${a.price.toLocaleString("tr-TR")} ₺ hedefine ulaştı! Güncel: ${currentPrice.toLocaleString("tr-TR")} ₺`,
            icon: "/favicon.ico",
          });
        });
        // Tetiklenen alarmları sil
        const remaining = alarms.filter(a => !triggered.includes(a));
        localStorage.setItem("price_alarms", JSON.stringify(remaining));
        if (triggered.length > 0) { setAlarmSet(false); }
      }
    } catch {}
  }, [data?.price?.price, symbol]);

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
        <div className="flex items-center gap-2">
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
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowAlarm(s => !s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm ${alarmSet ? "border-yellow-500 text-yellow-600" : "border-border text-text-secondary hover:border-yellow-500 hover:text-yellow-600"}`}
              title="Fiyat Alarmı Kur"
            >
              🔔 {alarmSet ? "Alarm Kurulu" : "Alarm Kur"}
            </button>
            {showAlarm && (
              <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 50, background: "var(--os-card)", border: "1px solid var(--os-line-2)", borderRadius: 6, padding: 14, width: 240, boxShadow: "0 4px 20px rgba(48,35,18,0.16)" }}>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-muted)", marginBottom: 8 }}>FİYAT ALARMI · {symbol}</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {(["above", "below"] as const).map(d => (
                    <button key={d} onClick={() => setAlarmDir(d)} style={{ flex: 1, fontFamily: "var(--os-mono)", fontSize: 9.5, fontWeight: 600, padding: "4px 0", borderRadius: 4, border: `1px solid ${alarmDir === d ? "var(--os-accent)" : "var(--os-line)"}`, background: alarmDir === d ? "rgba(194,65,12,0.08)" : "none", color: alarmDir === d ? "var(--os-accent)" : "var(--os-muted)", cursor: "pointer", textTransform: "uppercase" }}>
                      {d === "above" ? "▲ Üzerine çıkınca" : "▼ Altına düşünce"}
                    </button>
                  ))}
                </div>
                <input
                  value={alarmPrice}
                  onChange={e => setAlarmPrice(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveAlarm()}
                  placeholder="Fiyat girin..."
                  style={{ width: "100%", fontFamily: "var(--os-mono)", fontSize: 11, background: "var(--os-page)", border: "1px solid var(--os-line-2)", borderRadius: 4, padding: "6px 8px", outline: "none", color: "var(--os-ink)", marginBottom: 8 }}
                />
                <button onClick={saveAlarm} style={{ width: "100%", fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 700, background: "var(--os-accent)", color: "#fff", border: "none", borderRadius: 4, padding: "6px 0", cursor: "pointer" }}>ALARMI KAYDET</button>
              </div>
            )}
          </div>
        </div>
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
