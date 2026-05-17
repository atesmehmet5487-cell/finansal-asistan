"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BIST_SYMBOLS = ["ASELS", "THYAO", "GARAN", "AKBNK", "ISCTR", "EREGL", "KCHOL", "BIMAS", "TCELL", "PGSUS", "BIST100"];
const MARKET_SYMBOLS = ["BIST100", "DOLAR", "EURO", "ALTIN", "BTC", "GUMUS"];

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function heatClass(pct: number | null | undefined): string {
  if (pct == null) return "flat";
  if (pct >= 2)    return "up-3";
  if (pct >= 1)    return "up-2";
  if (pct >= 0.1)  return "up-1";
  if (pct > -0.1)  return "flat";
  if (pct > -1)    return "dn-1";
  if (pct > -2)    return "dn-2";
  return "dn-3";
}

function greet(h: number): string {
  if (h < 6)  return "İyi geceler";
  if (h < 12) return "İyi sabahlar";
  if (h < 17) return "İyi günler";
  if (h < 21) return "İyi akşamlar";
  return "İyi geceler";
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "şimdi";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const SEP = <span style={{ color: "var(--os-line-2)" }}> // </span>;

export default function Dashboard() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [news, setNews]     = useState<any[]>([]);
  const [clock, setClock]   = useState({ h: "00", m: "00", s: "00" });
  const [now, setNow]       = useState(new Date());
  const { lastMessage }     = useWebSocket(`${API.replace("http", "ws")}/ws/live`);

  // Canlı saat
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      setClock({
        h: String(d.getHours()).padStart(2, "0"),
        m: String(d.getMinutes()).padStart(2, "0"),
        s: String(d.getSeconds()).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Veri çekimi
  useEffect(() => {
    const all = [...new Set([...BIST_SYMBOLS, ...MARKET_SYMBOLS])];
    Promise.all([
      fetch(`${API}/api/v1/news/feed?category=all&limit=30`).then(r => r.json()).catch(() => ({ news: [] })),
      ...all.map(s => fetch(`${API}/api/v1/assets/${s}`).then(r => r.ok ? r.json() : null).catch(() => null)),
    ]).then(([newsRes, ...assetRes]) => {
      setNews(newsRes.news || []);
      const pm: Record<string, any> = {};
      all.forEach((s, i) => { if (assetRes[i]) pm[s] = assetRes[i]; });
      setPrices(pm);
    });
  }, []);

  // WebSocket fiyat güncellemeleri
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

  const signals  = news.filter(n => ["CRITICAL", "HIGH"].includes(n.importance)).slice(0, 4);
  const feedNews = news.slice(0, 6);

  // En yüksek değişim gösteren hisse (odak varlık)
  const featured = BIST_SYMBOLS.filter(s => s !== "BIST100").reduce((best, s) => {
    return Math.abs(gc(s) ?? 0) > Math.abs(gc(best) ?? 0) ? s : best;
  }, "ASELS");

  const isUp = (sym: string) => (gc(sym) ?? 0) >= 0;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gridTemplateRows: "150px minmax(0,1fr) minmax(0,1fr)",
      gap: 10,
      flex: 1,
      minHeight: 0,
    }}>

      {/* ── 01 OPERATÖR ── */}
      <section className="card" style={{ gridColumn: "1/4", gridRow: 1 }}>
        <div className="card-head">
          <span className="eyebrow"><b>01</b>{SEP}OPERATÖR</span>
          <span className="live-pill">ÇEVRİMİÇİ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #C2410C, #D97706)",
            color: "#fff", display: "grid", placeItems: "center",
            fontFamily: "var(--os-serif)", fontSize: 18,
          }}>M</div>
          <div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 19, lineHeight: 1.1 }}>
              Mehmet <em>Ateş</em>
            </div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-muted)", marginTop: 3 }}>
              YATIRIMCI · İSTANBUL
            </div>
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
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 11, fontWeight: 600 }}>{fmt(price)}</span>
              {pct != null && (
                <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: pct >= 0 ? "var(--lz-success)" : "var(--lz-danger)" }}>
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </span>
              )}
            </Link>
          );
        })}
      </section>

      {/* ── 04 BIST HARİTASI ── */}
      <section className="card" style={{ gridColumn: "1/4", gridRow: 2 }}>
        <div className="card-head">
          <span className="eyebrow"><b>04</b>{SEP}BIST HARİTASI</span>
          <span className="eyebrow">BIST</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridAutoRows: "1fr", gap: 3 }}>
          {BIST_SYMBOLS.filter(s => s !== "BIST100").map(sym => {
            const pct = gc(sym);
            return (
              <Link key={sym} href={`/${sym}`} className={`heat ${heatClass(pct)}`}>
                <span className="t">{sym}</span>
                <span className="p">{pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}</span>
              </Link>
            );
          })}
        </div>
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
            { time: "PZT · 10:00", title: "BIST Açılış",        sub: "Normal seans başlangıcı",    high: false },
            { time: "ÇAR · 15:30", title: "ABD Enflasyon (CPI)", sub: "Beklenti: %3.2 yıllık",      high: true  },
            { time: "PER · 22:00", title: "Fed Tutanakları",     sub: "FOMC faiz kararı öncesi",    high: true  },
            { time: "CUM · 16:30", title: "İstihdam Verisi",     sub: "ABD Tarım Dışı İstihdam",    high: false },
          ].map((ev, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "68px 1fr", gap: 10, padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid var(--os-line)" }}>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", color: ev.high ? "var(--os-accent)" : "var(--os-muted)", paddingTop: 2 }}>
                {ev.time}
              </span>
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
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: n.importance === "CRITICAL" ? "#C2410C" : "#D97706",
                color: "#fff", display: "grid", placeItems: "center",
                fontFamily: "var(--os-mono)", fontSize: 9, fontWeight: 700, flexShrink: 0,
              }}>
                {(n.source || "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.source}</span>
                  {n.importance === "CRITICAL" && (
                    <span style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "var(--os-accent)", color: "#fff", textTransform: "uppercase", flexShrink: 0 }}>
                      ACİL
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.title}
                </div>
              </div>
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, color: "var(--os-muted)", flexShrink: 0 }}>{timeAgo(n.published_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 03b PİYASA & DAĞILIM (2+3. satır sağ sütun) ── */}
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
                    {fmt(price)}
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
                  strokeLinecap="round" strokeDasharray={`${r.dash} 151`}
                  transform="rotate(-90 30 30)" />
              </svg>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--os-muted)", marginTop: 4 }}>{r.label}</div>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 600, marginTop: 1 }}>%{r.pct}</div>
            </div>
          ))}
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
          <span className="eyebrow"><b>07</b>{SEP}ŞU AN İZLENİYOR</span>
          <span className="eyebrow">BIST · {featured}</span>
        </div>
        <Link href={`/${featured}`} style={{ textDecoration: "none", color: "inherit", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 6,
              background: isUp(featured)
                ? "linear-gradient(135deg, #047857, #064E3B)"
                : "linear-gradient(135deg, #DC2626, #7F1D1D)",
              display: "grid", placeItems: "center",
              color: "#fff", fontFamily: "var(--os-serif)", fontSize: 28,
              boxShadow: "inset 0 0 24px rgba(0,0,0,0.18)",
            }}>
              {featured.charAt(0)}
            </div>
            <div>
              <div style={{ fontFamily: "var(--os-serif)", fontSize: 24, lineHeight: 1.1 }}>
                {featured} <em>Hisse</em>
              </div>
              <div style={{ fontFamily: "var(--os-mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--os-muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <b style={{ color: "var(--os-ink)" }}>{fmt(gp(featured))} ₺</b>
                {gc(featured) != null && (
                  <span style={{ color: isUp(featured) ? "var(--lz-success)" : "var(--lz-danger)", fontWeight: 700 }}>
                    {isUp(featured) ? "▲" : "▼"} {Math.abs(gc(featured)!).toFixed(2)}%
                  </span>
                )}
                {prices[featured]?.price?.volume && (
                  <span>· HACİM <b style={{ color: "var(--os-ink)" }}>{(prices[featured].price.volume / 1e6).toFixed(1)}M</b></span>
                )}
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <svg style={{ marginTop: 10, flex: 1, minHeight: 36, width: "100%" }} viewBox="0 0 600 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spkF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={isUp(featured) ? "#047857" : "#DC2626"} stopOpacity="0.3" />
                <stop offset="100%" stopColor={isUp(featured) ? "#047857" : "#DC2626"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,38 L60,34 L120,30 L180,26 L240,22 L300,18 L360,20 L420,16 L480,12 L540,8 L600,6 L600,50 L0,50 Z"
              fill="url(#spkF)" />
            <path d="M0,38 L60,34 L120,30 L180,26 L240,22 L300,18 L360,20 L420,16 L480,12 L540,8 L600,6"
              fill="none"
              stroke={isUp(featured) ? "#047857" : "#DC2626"}
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

    </div>
  );
}
