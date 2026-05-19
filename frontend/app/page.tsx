"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_BIST = ["ASELS", "THYAO", "GARAN", "AKBNK", "ISCTR", "EREGL", "KCHOL", "BIMAS", "TCELL", "PGSUS", "BIST100"];
const MARKET_SYMBOLS = ["BIST100", "DOLAR", "EURO", "ALTIN", "BTC", "GUMUS"];

const DAY_NAMES   = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function heatClass(pct: number | null | undefined) {
  if (pct == null) return "flat";
  if (pct >= 2)   return "up-3";
  if (pct >= 1)   return "up-2";
  if (pct >= 0.1) return "up-1";
  if (pct > -0.1) return "flat";
  if (pct > -1)   return "dn-1";
  if (pct > -2)   return "dn-2";
  return "dn-3";
}

function greet(h: number) {
  if (h < 6)  return "İyi geceler";
  if (h < 12) return "İyi sabahlar";
  if (h < 17) return "İyi günler";
  if (h < 21) return "İyi akşamlar";
  return "İyi geceler";
}

function timeAgo(d?: string | null) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1)  return "şimdi";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

function fmt(n?: number | null, d = 2) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const SEP = <span style={{ color: "var(--os-line-2)" }}> // </span>;

export default function Dashboard() {
  const [prices, setPrices]     = useState<Record<string, any>>({});
  const [news, setNews]         = useState<any[]>([]);
  const [calEvents, setCalEvents] = useState<any[]>([]);
  const [calConfigured, setCalConfigured] = useState(true);
  const [clock, setClock]       = useState({ h: "00", m: "00", s: "00" });
  const [now, setNow]           = useState(new Date());
  const [loading, setLoading]   = useState(true);

  // Heatmap düzenleme
  const [bistSymbols, setBistSymbols] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_BIST;
    try {
      const saved = localStorage.getItem("bist_heatmap");
      return saved ? JSON.parse(saved) : DEFAULT_BIST;
    } catch { return DEFAULT_BIST; }
  });
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");

  // Watchlist'i localStorage'dan oku
  useEffect(() => {
    try {
      setWatchlist(JSON.parse(localStorage.getItem("watchlist") || "[]"));
    } catch { setWatchlist([]); }
    // localStorage güncellendiğinde yenile (diğer tab'dan)
    const handler = (e: StorageEvent) => {
      if (e.key === "watchlist") {
        try { setWatchlist(JSON.parse(e.newValue || "[]")); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const { lastMessage } = useWebSocket(`${API.replace("http", "ws")}/ws/live`);

  // localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("bist_heatmap", JSON.stringify(bistSymbols));
  }, [bistSymbols]);

  // Canlı saat
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      setClock({ h: String(d.getHours()).padStart(2,"0"), m: String(d.getMinutes()).padStart(2,"0"), s: String(d.getSeconds()).padStart(2,"0") });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Takvim etkinlikleri (ayrı fetch, 30dk cache)
  useEffect(() => {
    fetch(`${API}/api/v1/calendar/events?days=7`)
      .then(r => r.json())
      .then(d => { setCalEvents(d.events || []); setCalConfigured(d.configured ?? true); })
      .catch(() => {});
    // Her 30 dakikada bir yenile
    const id = setInterval(() => {
      fetch(`${API}/api/v1/calendar/events?days=7`)
        .then(r => r.json())
        .then(d => { setCalEvents(d.events || []); setCalConfigured(d.configured ?? true); })
        .catch(() => {});
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Fiyat çekimi — tek batch çağrısı (20+ ayrı istek yerine 2 istek)
  const fetchPrices = useCallback(async () => {
    try {
      const [newsRes, pricesRes] = await Promise.all([
        fetch(`${API}/api/v1/news/feed?category=all&limit=30`).then(r => r.json()).catch(() => ({ news: [] })),
        fetch(`${API}/api/v1/prices/all`).then(r => r.json()).catch(() => ({ prices: {} })),
      ]);
      setNews(newsRes.news || []);
      const raw: Record<string, any> = pricesRes.prices || {};
      const pm: Record<string, any> = {};
      // Her price objesini {price: priceObj} formatına sar (gp/gc uyumluluğu)
      Object.entries(raw).forEach(([sym, priceObj]) => { pm[sym] = { price: priceObj }; });
      if (Object.keys(pm).length > 0) setPrices(pm);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices();
    // Fiyatlar null ise 60 saniyede bir yeniden dene
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  // WebSocket güncellemeleri
  useEffect(() => {
    if (lastMessage?.type === "PRICE_UPDATE" && lastMessage.symbol) {
      setPrices(prev => ({
        ...prev,
        [lastMessage.symbol]: { ...(prev[lastMessage.symbol] || {}), price: lastMessage.data },
      }));
    }
  }, [lastMessage]);

  const gp = (sym: string) => prices[sym]?.price?.price;
  const gc = (sym: string) => prices[sym]?.price?.change_pct;
  const isUp = (sym: string) => (gc(sym) ?? 0) >= 0;

  const signals  = news.filter(n => ["CRITICAL", "HIGH"].includes(n.importance)).slice(0, 4);
  const feedNews = news.slice(0, 6);

  const featured = bistSymbols.filter(s => s !== "BIST100").reduce((best, s) =>
    Math.abs(gc(s) ?? 0) > Math.abs(gc(best) ?? 0) ? s : best
  , bistSymbols.find(s => s !== "BIST100") || "ASELS");

  // Heatmap symbol ekleme
  const addSymbol = async () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (bistSymbols.includes(sym)) { setAddError("Zaten listede var."); return; }
    try {
      const res = await fetch(`${API}/api/v1/search?q=${sym}`);
      const data = await res.json();
      if (!data.results?.length) { setAddError("Sembol bulunamadı."); return; }
      const found = data.results.find((r: any) => r.symbol === sym) || data.results[0];
      setBistSymbols(prev => [...prev, found.symbol]);
      setAddInput("");
      setAddError("");
    } catch { setAddError("Arama başarısız."); }
  };

  const removeSymbol = (sym: string) => setBistSymbols(prev => prev.filter(s => s !== sym));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "150px minmax(0,1fr) minmax(0,1fr)", gap: 10, flex: 1, minHeight: 0 }}>

      {/* ── 01 OPERATÖR ── */}
      <section className="card" style={{ gridColumn: "1/4", gridRow: 1 }}>
        <div className="card-head">
          <span className="eyebrow"><b>01</b>{SEP}OPERATÖR</span>
          <span className="live-pill">ÇEVRİMİÇİ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#C2410C,#D97706)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--os-serif)", fontSize: 18 }}>M</div>
          <div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 19, lineHeight: 1.1 }}>Mehmet <em>Ateş</em></div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-muted)", marginTop: 3 }}>YATIRIMCI · İSTANBUL</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--os-line)" }}>
          <div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", color: "var(--os-muted)", letterSpacing: "0.6px", marginBottom: 2 }}>ODAK</div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase" }}>BIST ANALİZ</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", color: "var(--os-muted)", letterSpacing: "0.6px", marginBottom: 2 }}>DURUM</div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase" }}>İZLİYOR</div>
          </div>
        </div>
      </section>

      {/* ── 02 OTURUM ── */}
      <section className="card" style={{ gridColumn: "4/10", gridRow: 1 }}>
        <div className="card-head">
          <span className="eyebrow"><b>02</b>{SEP}OTURUM</span>
          <span className="eyebrow">UTC <span style={{ color: "var(--os-line-2)" }}>·</span> +03:00 <span style={{ color: "var(--os-line-2)" }}>·</span> TRT</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "flex-end", gap: 20, flex: 1, minHeight: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {greet(now.getHours())}, <em>Mehmet.</em>
            </div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-muted)", marginTop: 10 }}>
              <b style={{ color: "var(--os-ink-2)" }}>{DAY_NAMES[now.getDay()].toUpperCase()}</b>
              {" · "}{now.getDate()} {MONTH_NAMES[now.getMonth()].toUpperCase()}, {now.getFullYear()}
            </div>
          </div>
          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            <div style={{ fontFamily: "var(--os-mono)", fontWeight: 500, fontSize: 42, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {clock.h}<span style={{ color: "var(--os-muted)" }}>:</span>{clock.m}
              <span style={{ fontSize: 14, color: "var(--os-muted)", fontWeight: 500 }}>{clock.s}</span>
            </div>
            <div className="eyebrow" style={{ marginTop: 6 }}>
              BORSA · {now.getDay() >= 1 && now.getDay() <= 5 && now.getHours() >= 10 && now.getHours() < 18 ? "AÇIK" : "KAPALI"}
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 ENDEKS ── */}
      <section className="card" style={{ gridColumn: "10/13", gridRow: 1 }}>
        <div className="card-head">
          <span className="eyebrow"><b>03</b>{SEP}ENDEKS</span>
          <span className="live-pill">CANLI</span>
        </div>
        {(["BIST100", "DOLAR", "EURO"] as const).map(sym => {
          const price = gp(sym);
          const pct   = gc(sym);
          return (
            <Link key={sym} href={`/${sym}`} style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--os-muted)" }}>{sym}</span>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 11, fontWeight: 600 }}>
                {loading ? <span style={{ opacity: 0.4 }}>···</span> : fmt(price)}
              </span>
              {pct != null ? (
                <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: pct >= 0 ? "var(--lz-success)" : "var(--lz-danger)" }}>
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </span>
              ) : <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)" }}>—</span>}
            </Link>
          );
        })}
      </section>

      {/* ── 04 BIST HARİTASI ── */}
      <section className="card" style={{ gridColumn: "1/4", gridRow: 2 }}>
        <div className="card-head">
          <span className="eyebrow"><b>04</b>{SEP}BIST HARİTASI</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {editMode && (
              <button
                onClick={() => { setBistSymbols(DEFAULT_BIST); setEditMode(false); }}
                title="Sıfırla"
                style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: "var(--os-muted)", background: "none", border: "1px solid var(--os-line)", borderRadius: 3, padding: "2px 6px", cursor: "pointer" }}
              >SIFIRLA</button>
            )}
            <button
              onClick={() => { setEditMode(e => !e); setAddInput(""); setAddError(""); }}
              style={{ fontFamily: "var(--os-mono)", fontSize: 9, fontWeight: 600, color: editMode ? "var(--os-accent)" : "var(--os-muted)", background: "none", border: `1px solid ${editMode ? "var(--os-accent)" : "var(--os-line)"}`, borderRadius: 3, padding: "2px 8px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.4px" }}
            >{editMode ? "TAMAM" : "DÜZENLE"}</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridAutoRows: editMode ? undefined : "1fr", gap: 3, alignContent: "start" }}>
          {bistSymbols.filter(s => s !== "BIST100").map(sym => {
            const pct = gc(sym);
            return (
              <div key={sym} style={{ position: "relative" }}>
                <Link href={editMode ? "#" : `/${sym}`} onClick={e => editMode && e.preventDefault()} className={`heat ${heatClass(pct)}`} style={{ minHeight: 44 }}>
                  <span className="t">{sym}</span>
                  <span className="p">{pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : loading ? "···" : "—"}</span>
                </Link>
                {editMode && (
                  <button
                    onClick={() => removeSymbol(sym)}
                    style={{ position: "absolute", top: 2, right: 2, width: 14, height: 14, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center", lineHeight: 1 }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sembol ekleme formu */}
        {editMode && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--os-line)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={addInput}
                onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(""); }}
                onKeyDown={e => e.key === "Enter" && addSymbol()}
                placeholder="FROTO, TUPRS..."
                style={{ flex: 1, fontFamily: "var(--os-mono)", fontSize: 10, textTransform: "uppercase", background: "var(--os-page)", border: "1px solid var(--os-line-2)", borderRadius: 3, padding: "4px 8px", outline: "none", color: "var(--os-ink)" }}
              />
              <button
                onClick={addSymbol}
                style={{ fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 700, background: "var(--os-accent)", color: "#fff", border: "none", borderRadius: 3, padding: "4px 10px", cursor: "pointer" }}
              >+</button>
            </div>
            {addError && <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: "var(--lz-danger)", marginTop: 3 }}>{addError}</div>}
          </div>
        )}
      </section>

      {/* ── 05 EKONOMİK TAKVİM ── */}
      <section className="card" style={{ gridColumn: "4/7", gridRow: 2 }}>
        <div className="card-head">
          <span className="eyebrow"><b>05</b>{SEP}EKONOMİK TAKVİM</span>
          <span className="eyebrow">{MONTH_NAMES[now.getMonth()].toUpperCase()} {now.getFullYear()}</span>
        </div>
        <div style={{ fontFamily: "var(--os-serif)", fontSize: 19, marginBottom: 8, flexShrink: 0 }}>
          {DAY_NAMES[now.getDay()]}, <em>{now.getDate()} {MONTH_NAMES[now.getMonth()]}</em>
        </div>
        <ul style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {[
            { time: "PZT · 10:00", title: "BIST Açılış",         sub: "Normal seans başlangıcı",  high: false },
            { time: "ÇAR · 15:30", title: "ABD Enflasyon (CPI)", sub: "Beklenti: %3.2 yıllık",    high: true  },
            { time: "PER · 22:00", title: "Fed Tutanakları",      sub: "FOMC faiz kararı öncesi", high: true  },
            { time: "CUM · 16:30", title: "İstihdam Verisi",      sub: "ABD Tarım Dışı İstihdam", high: false },
          ].map((ev, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "68px 1fr", gap: 10, padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid var(--os-line)" }}>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", color: ev.high ? "var(--os-accent)" : "var(--os-muted)", paddingTop: 2 }}>{ev.time}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25 }}>{ev.title}</div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", marginTop: 2 }}>{ev.sub}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 06 SİNYALLER ── */}
      <section className="card" style={{ gridColumn: "7/10", gridRow: 2 }}>
        <div className="card-head">
          <span className="eyebrow"><b>06</b>{SEP}SİNYALLER</span>
          <span className="eyebrow" style={{ color: "var(--os-accent)" }}>{signals.length} KRİTİK</span>
        </div>
        <ul style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6 }}>
          {signals.length === 0 ? (
            <li style={{ fontFamily: "var(--os-mono)", fontSize: 10, color: "var(--os-muted)", margin: "auto", textAlign: "center" }}>Kritik sinyal yok</li>
          ) : signals.map((n, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10, alignItems: "center", padding: "7px 10px", background: "var(--os-page)", borderRadius: 4, border: "1px solid var(--os-line)" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: n.importance === "CRITICAL" ? "#C2410C" : "#D97706", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--os-mono)", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                {(n.source || "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.source}</span>
                  {n.importance === "CRITICAL" && (
                    <span style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "var(--os-accent)", color: "#fff", textTransform: "uppercase", flexShrink: 0 }}>ACİL</span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
              </div>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", flexShrink: 0 }}>{timeAgo(n.published_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 03b PİYASA & DAĞILIM (satır 2+3) ── */}
      <section className="card" style={{ gridColumn: "10/13", gridRow: "2/4" }}>
        <div className="card-head">
          <span className="eyebrow"><b>03b</b>{SEP}PİYASA & DAĞILIM</span>
          <span className="eyebrow">CANLI</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { sym: "BIST100", label: "BIST 100" },
            { sym: "DOLAR",   label: "USD/TRY"  },
            { sym: "EURO",    label: "EUR/TRY"  },
            { sym: "ALTIN",   label: "ALTIN"    },
            { sym: "BTC",     label: "BTC"      },
            { sym: "GUMUS",   label: "GÜMÜŞ"    },
          ].map(({ sym, label }) => {
            const price = gp(sym);
            const pct   = gc(sym);
            const up    = (pct ?? 0) >= 0;
            return (
              <Link key={sym} href={`/${sym}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--os-card)", border: "1px solid var(--os-line)", borderRadius: 5, padding: "8px 10px" }}>
                  <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--os-muted)", display: "flex", justifyContent: "space-between" }}>
                    <span>{label}</span>
                    {pct != null && <span style={{ color: up ? "var(--lz-success)" : "var(--lz-danger)" }}>{up ? "▲" : "▼"}</span>}
                  </div>
                  <div style={{ fontFamily: "var(--os-serif)", fontSize: 18, lineHeight: 1.1, marginTop: 2, fontVariantNumeric: "tabular-nums", color: "var(--os-ink)" }}>
                    {loading ? <span style={{ opacity: 0.35, fontSize: 12 }}>yükleniyor</span> : fmt(price)}
                    {pct != null && (
                      <small style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: up ? "var(--lz-success)" : "var(--lz-danger)", marginLeft: 3 }}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                      </small>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Portföy dağılım rings */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--os-line)", textAlign: "center", flexShrink: 0 }}>
          {[
            { label: "HİSSE",  pct: 62, color: "#C2410C", dash: 113 },
            { label: "NAKİT",  pct: 24, color: "#0E7C66", dash: 60  },
            { label: "KRİPTO", pct: 14, color: "#D97706", dash: 35  },
          ].map(r => (
            <div key={r.label}>
              <svg viewBox="0 0 60 60" style={{ width: 44, height: 44 }}>
                <circle cx="30" cy="30" r="24" fill="none" stroke="var(--os-line-2)" strokeWidth="5" />
                <circle cx="30" cy="30" r="24" fill="none" stroke={r.color} strokeWidth="5"
                  strokeLinecap="round" strokeDasharray={`${r.dash} 151`} transform="rotate(-90 30 30)" />
              </svg>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--os-muted)", marginTop: 4 }}>{r.label}</div>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 600, marginTop: 1 }}>%{r.pct}</div>
            </div>
          ))}
        </div>

        {/* ── TAKVİM HATIRLATICI ── */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--os-line)", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ marginBottom: 6, flexShrink: 0 }}>
            <span className="eyebrow"><b>📅</b> TAKVİM</span>
            <span className="eyebrow">{MONTH_NAMES[now.getMonth()].slice(0,3).toUpperCase()} {now.getDate()}</span>
          </div>
          {!calConfigured ? (
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: "var(--os-muted)", lineHeight: 1.6 }}>
              Railway'de <b style={{ color: "var(--os-ink)" }}>GOOGLE_CALENDAR_ICAL_URL</b> env değişkenini ekleyin.
            </div>
          ) : calEvents.length === 0 ? (
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", textAlign: "center", margin: "auto" }}>
              Yaklaşan etkinlik yok
            </div>
          ) : (
            <ul style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {calEvents.slice(0, 8).map((ev, i) => {
                const isToday = ev.days_from_now === 0;
                const isTomorrow = ev.days_from_now === 1;
                const dayLabel = isToday ? "BUGÜN" : isTomorrow ? "YARIN" : `${ev.days_from_now}G`;
                const isPayment = /ödeme|fatura|aidat|kira|borç|taksit|payment|bill/i.test(ev.title + ev.description);
                return (
                  <li key={i} style={{
                    display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 6, alignItems: "flex-start",
                    padding: "5px 7px", borderRadius: 4,
                    background: isToday ? "rgba(194,65,12,0.06)" : "var(--os-page)",
                    border: `1px solid ${isToday ? "rgba(194,65,12,0.2)" : "var(--os-line)"}`,
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--os-mono)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: isToday ? "var(--os-accent)" : "var(--os-muted)", letterSpacing: "0.3px" }}>{dayLabel}</div>
                      {ev.time && <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: "var(--os-ink-2)", marginTop: 1 }}>{ev.time}</div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--os-ink)", display: "flex", alignItems: "center", gap: 4 }}>
                        {isPayment && <span style={{ color: "#D97706", fontSize: 9 }}>₺</span>}
                        {ev.title}
                      </div>
                      {ev.description && (
                        <div style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, color: "var(--os-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.description}</div>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--os-mono)", fontSize: 8, color: ev.all_day ? "var(--os-muted)" : "var(--os-ink-2)", flexShrink: 0 }}>
                      {ev.all_day ? "tgn" : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── 09 HABER AKIŞI ── */}
      <section className="card" style={{ gridColumn: "1/4", gridRow: 3 }}>
        <div className="card-head">
          <span className="eyebrow"><b>09</b>{SEP}HABER AKIŞI</span>
          <span className="live-pill">CANLI</span>
        </div>
        <ul style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {feedNews.map((n, i) => (
            <li key={i} style={{ padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid var(--os-line)" }}>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-accent)", display: "flex", alignItems: "center" }}>
                {n.source}
                <span style={{ color: "var(--os-muted)", marginLeft: "auto" }}>{timeAgo(n.published_at)}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                {n.title}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 07 ŞU AN İZLENİYOR ── */}
      <section className="card" style={{ gridColumn: "4/10", gridRow: 3 }}>
        <div className="card-head">
          <span className="eyebrow"><b>07</b>{SEP}İZLEME LİSTEM</span>
          <span className="eyebrow">{watchlist.length > 0 ? `${watchlist.length} HİSSE` : `BIST · ${featured}`}</span>
        </div>

        {watchlist.length === 0 ? (
          /* İzleme listesi boş → en çok hareket eden hisseyi göster */
          <Link href={`/${featured}`} style={{ textDecoration: "none", color: "inherit", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 6, background: isUp(featured) ? "linear-gradient(135deg,#047857,#064E3B)" : "linear-gradient(135deg,#DC2626,#7F1D1D)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--os-serif)", fontSize: 28, boxShadow: "inset 0 0 24px rgba(0,0,0,0.18)" }}>
                {featured.charAt(0)}
              </div>
              <div>
                <div style={{ fontFamily: "var(--os-serif)", fontSize: 24, lineHeight: 1.1 }}>{featured} <em>Hisse</em></div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--os-muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <b style={{ color: "var(--os-ink)" }}>{fmt(gp(featured))} ₺</b>
                  {gc(featured) != null && (
                    <span style={{ color: isUp(featured) ? "var(--lz-success)" : "var(--lz-danger)", fontWeight: 700 }}>
                      {isUp(featured) ? "▲" : "▼"} {Math.abs(gc(featured)!).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", marginTop: "auto", paddingTop: 12, textAlign: "center" }}>
              Hisse sayfalarından "İzlemeye Ekle" butonuna basarak buraya ekleyebilirsiniz
            </div>
            <svg style={{ marginTop: 10, flex: 1, minHeight: 36, width: "100%" }} viewBox="0 0 600 50" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spkF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={isUp(featured) ? "#047857" : "#DC2626"} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isUp(featured) ? "#047857" : "#DC2626"} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,38 L60,34 L120,30 L180,26 L240,22 L300,18 L360,20 L420,16 L480,12 L540,8 L600,6 L600,50 L0,50 Z" fill="url(#spkF)" />
              <path d="M0,38 L60,34 L120,30 L180,26 L240,22 L300,18 L360,20 L420,16 L480,12 L540,8 L600,6"
                fill="none" stroke={isUp(featured) ? "#047857" : "#DC2626"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          /* İzleme listesi dolu → tüm hisseleri listele */
          <ul style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {watchlist.map((sym, i) => {
              const price = gp(sym);
              const pct = gc(sym);
              const up = (pct ?? 0) >= 0;
              return (
                <li key={sym}>
                  <Link href={`/${sym}`} style={{ textDecoration: "none", display: "grid", gridTemplateColumns: "36px 1fr auto auto", gap: 10, alignItems: "center", padding: "7px 10px", background: "var(--os-page)", borderRadius: 4, border: "1px solid var(--os-line)" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: up ? "linear-gradient(135deg,#047857,#064E3B)" : "linear-gradient(135deg,#DC2626,#7F1D1D)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--os-serif)", fontSize: 14, flexShrink: 0 }}>
                      {sym.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, fontWeight: 700, color: "var(--os-ink)" }}>{sym}</div>
                    </div>
                    <div style={{ fontFamily: "var(--os-mono)", fontSize: 12, fontWeight: 600, color: "var(--os-ink)", textAlign: "right" }}>
                      {loading ? <span style={{ opacity: 0.4 }}>···</span> : fmt(price)}
                    </div>
                    <div style={{ fontFamily: "var(--os-mono)", fontSize: 10, color: pct != null ? (up ? "var(--lz-success)" : "var(--lz-danger)") : "var(--os-muted)", textAlign: "right", minWidth: 52 }}>
                      {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
