"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [bistOpen, setBistOpen] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, "0");
      const D = String(d.getDate()).padStart(2, "0");
      setClock(`${Y}${M}${D}-${hh}${mm}`);
      const day = d.getDay();
      const h = d.getHours();
      setBistOpen(day >= 1 && day <= 5 && h >= 10 && h < 18);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch { setResults([]); }
    }, 300);
  }, [query]);

  const handleSelect = (symbol: string) => {
    setQuery(""); setOpen(false); router.push(`/${symbol}`);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) handleSelect(results[0].symbol);
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 500,
      letterSpacing: "0.4px", textTransform: "uppercase",
      color: "var(--os-ink-2)",
      paddingBottom: 10,
      marginBottom: 10,
      borderBottom: "1px solid var(--os-line)",
      flexShrink: 0,
      position: "relative",
    }}>
      {/* Sol: marka */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/" style={{ color: "var(--os-accent)", fontSize: 14, lineHeight: 0, textDecoration: "none" }}>●</Link>
        <span><b style={{ color: "var(--os-ink)" }}>FİNANSAL ASİSTAN</b> // V1.0</span>
      </div>

      {/* Orta: arama */}
      <div style={{ position: "relative", flex: 1, maxWidth: 300, margin: "0 24px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--os-page)", border: "1px solid var(--os-line-2)",
          borderRadius: 4, padding: "4px 10px",
        }}>
          <span style={{ color: "var(--os-muted)", fontSize: 12 }}>⌕</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ASELS, THYAO, ALTIN..."
            style={{
              background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--os-mono)", fontSize: 10, color: "var(--os-ink)",
              flex: 1, textTransform: "uppercase", letterSpacing: "0.4px",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setOpen(false); }}
              style={{ color: "var(--os-muted)", cursor: "pointer", background: "none", border: "none", fontSize: 14, lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {open && results.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: "var(--os-card)", border: "1px solid var(--os-line-2)",
            borderRadius: 4, zIndex: 50, overflow: "hidden",
            boxShadow: "0 4px 16px rgba(48,35,18,0.14)",
          }}>
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelect(item.symbol)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px",
                  borderTop: i === 0 ? "none" : "1px solid var(--os-line)",
                  cursor: "pointer", background: "none", border: "none",
                  borderTopColor: "var(--os-line)", textAlign: "left",
                  fontFamily: "var(--os-mono)", fontSize: 10,
                }}
                onMouseOver={e => (e.currentTarget.style.background = "rgba(194,65,12,0.05)")}
                onMouseOut={e => (e.currentTarget.style.background = "none")}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "var(--os-ink)", letterSpacing: "0.3px" }}>{item.symbol}</div>
                  <div style={{ color: "var(--os-muted)", fontSize: 9, marginTop: 1, textTransform: "none" }}>{item.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {item.price != null && (
                    <div style={{ fontWeight: 600, color: "var(--os-ink)" }}>
                      {item.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  {item.change_pct != null && (
                    <div style={{ fontSize: 9, color: item.change_pct >= 0 ? "var(--lz-success)" : "var(--lz-danger)" }}>
                      {item.change_pct >= 0 ? "+" : ""}{item.change_pct.toFixed(2)}%
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sağ: durum */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span>İSTANBUL <span style={{ color: "var(--os-line-2)" }}>·</span> <b style={{ color: "var(--os-ink)" }}>TR</b></span>
        <span style={{ color: "var(--os-line-2)" }}>·</span>
        <span>
          BIST{" "}
          <b style={{ color: bistOpen ? "var(--lz-success)" : "var(--lz-danger)" }}>
            {bistOpen ? "AÇIK" : "KAPALI"}
          </b>
        </span>
        <span style={{ color: "var(--os-line-2)" }}>·</span>
        <Link href="/portfolio" style={{ color: "var(--os-muted)", textDecoration: "none" }}>
          PORTFÖY
        </Link>
        <span style={{ color: "var(--os-line-2)" }}>·</span>
        <Link href="/news" style={{ color: "var(--os-muted)", textDecoration: "none" }}>
          HABERLER
        </Link>
        <span style={{ color: "var(--os-line-2)" }}>·</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</span>
      </div>
    </header>
  );
}
