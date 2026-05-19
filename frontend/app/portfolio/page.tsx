"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Holding {
  id: string;
  symbol: string;
  qty: number;
  avgCost: number;
  addedAt: string;
}

function fmt(n?: number | null, d = 2) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

const SEP = <span style={{ color: "var(--os-line-2)" }}> // </span>;

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // localStorage'dan yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem("portfolio");
      if (saved) setHoldings(JSON.parse(saved));
    } catch {}
  }, []);

  // Fiyatları çek
  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/prices/all`).then(r => r.json());
      const raw: Record<string, any> = res.prices || {};
      const map: Record<string, number> = {};
      Object.entries(raw).forEach(([s, p]: [string, any]) => {
        if (p?.price != null) map[s] = p.price;
      });
      setPrices(map);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  const save = (list: Holding[]) => {
    setHoldings(list);
    localStorage.setItem("portfolio", JSON.stringify(list));
  };

  const addHolding = async () => {
    const symbol = sym.trim().toUpperCase();
    const quantity = parseFloat(qty.replace(",", "."));
    const avgCostVal = parseFloat(cost.replace(",", "."));
    if (!symbol || isNaN(quantity) || quantity <= 0 || isNaN(avgCostVal) || avgCostVal <= 0) {
      setErr("Lütfen tüm alanları doğru doldurun."); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/search?q=${symbol}`).then(r => r.json());
      const found = res.results?.find((r: any) => r.symbol === symbol) || res.results?.[0];
      if (!found) { setErr("Sembol bulunamadı."); setLoading(false); return; }
      const existing = holdings.find(h => h.symbol === symbol);
      if (existing) {
        // Ortalama maliyeti yeniden hesapla
        const totalQty = existing.qty + quantity;
        const newAvg = (existing.qty * existing.avgCost + quantity * avgCostVal) / totalQty;
        save(holdings.map(h => h.symbol === symbol ? { ...h, qty: totalQty, avgCost: newAvg } : h));
      } else {
        save([...holdings, { id: Date.now().toString(), symbol, qty: quantity, avgCost: avgCostVal, addedAt: new Date().toISOString() }]);
      }
      setSym(""); setQty(""); setCost(""); setErr(""); setShowAdd(false);
    } catch { setErr("Hata oluştu."); }
    setLoading(false);
  };

  const remove = (id: string) => save(holdings.filter(h => h.id !== id));

  // Portföy özeti
  const totalCost = holdings.reduce((s, h) => s + h.qty * h.avgCost, 0);
  const totalValue = holdings.reduce((s, h) => s + h.qty * (prices[h.symbol] ?? h.avgCost), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isProfit = totalPnl >= 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 0", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Başlık */}
      <div className="card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "var(--os-muted)", textDecoration: "none" }}><ArrowLeft size={16} /></Link>
          <span className="eyebrow"><b>08</b>{SEP}PORTFÖY TAKİBİ</span>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--os-mono)", fontSize: 9.5, fontWeight: 700, background: "var(--os-accent)", color: "#fff", border: "none", borderRadius: 4, padding: "5px 12px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.4px" }}
        >
          <Plus size={12} /> Ekle
        </button>
      </div>

      {/* Özet */}
      {holdings.length > 0 && (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", color: "var(--os-muted)", letterSpacing: "0.5px", marginBottom: 4 }}>TOPLAM MALİYET</div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 22 }}>{fmt(totalCost)} ₺</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", color: "var(--os-muted)", letterSpacing: "0.5px", marginBottom: 4 }}>GÜNCEL DEĞER</div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 22 }}>{fmt(totalValue)} ₺</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", color: "var(--os-muted)", letterSpacing: "0.5px", marginBottom: 4 }}>KAR / ZARAR</div>
            <div style={{ fontFamily: "var(--os-serif)", fontSize: 22, color: isProfit ? "var(--lz-success)" : "var(--lz-danger)" }}>
              {isProfit ? "+" : ""}{fmt(totalPnl)} ₺
              <span style={{ fontFamily: "var(--os-mono)", fontSize: 12, marginLeft: 6 }}>({isProfit ? "+" : ""}{fmt(totalPnlPct)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Ekleme formu */}
      {showAdd && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="eyebrow"><b>YENİ POZİSYON EKLE</b></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "flex-end" }}>
            {[
              { label: "Sembol", value: sym, set: setSym, placeholder: "ASELS", upper: true },
              { label: "Adet / Lot", value: qty, set: setQty, placeholder: "100" },
              { label: "Ortalama Maliyet (₺)", value: cost, set: setCost, placeholder: "87.50" },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, textTransform: "uppercase", color: "var(--os-muted)", marginBottom: 3 }}>{f.label}</div>
                <input
                  value={f.value}
                  onChange={e => { f.set(f.upper ? e.target.value.toUpperCase() : e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  placeholder={f.placeholder}
                  style={{ width: "100%", fontFamily: "var(--os-mono)", fontSize: 11, background: "var(--os-page)", border: "1px solid var(--os-line-2)", borderRadius: 4, padding: "6px 10px", outline: "none", color: "var(--os-ink)", textTransform: f.upper ? "uppercase" : "none" }}
                />
              </div>
            ))}
            <button
              onClick={addHolding}
              disabled={loading}
              style={{ fontFamily: "var(--os-mono)", fontSize: 10, fontWeight: 700, background: "var(--os-accent)", color: "#fff", border: "none", borderRadius: 4, padding: "7px 16px", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
            >{loading ? "..." : "EKLE"}</button>
          </div>
          {err && <div style={{ fontFamily: "var(--os-mono)", fontSize: 9, color: "var(--lz-danger)" }}>{err}</div>}
        </div>
      )}

      {/* Holding listesi */}
      {holdings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontFamily: "var(--os-serif)", fontSize: 20, color: "var(--os-muted)", marginBottom: 8 }}>Portföy boş</div>
          <div style={{ fontFamily: "var(--os-mono)", fontSize: 10, color: "var(--os-muted)" }}>Üstteki "Ekle" butonuyla hisse ekleyin</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Tablo başlığı */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr 1fr 40px", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--os-line)", background: "var(--os-page)" }}>
            {["SEMBOL", "ADET", "MALİYET", "GÜNCEL", "TOPLAM MALİYET", "K/Z", ""].map(h => (
              <div key={h} style={{ fontFamily: "var(--os-mono)", fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--os-muted)", textAlign: h === "" ? "center" : "right", ...(h === "SEMBOL" ? { textAlign: "left" } : {}) }}>{h}</div>
            ))}
          </div>
          {holdings.map((h, i) => {
            const currentPrice = prices[h.symbol];
            const value = h.qty * (currentPrice ?? h.avgCost);
            const cost2 = h.qty * h.avgCost;
            const pnl = value - cost2;
            const pnlPct = (pnl / cost2) * 100;
            const up = pnl >= 0;
            return (
              <div key={h.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr 1fr 40px", gap: 8, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--os-line)", alignItems: "center" }}>
                <Link href={`/${h.symbol}`} style={{ fontFamily: "var(--os-mono)", fontSize: 12, fontWeight: 700, color: "var(--os-accent)", textDecoration: "none" }}>{h.symbol}</Link>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, textAlign: "right" }}>{fmt(h.qty, 0)}</div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, textAlign: "right" }}>{fmt(h.avgCost)} ₺</div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, textAlign: "right", color: currentPrice ? "var(--os-ink)" : "var(--os-muted)" }}>
                  {currentPrice ? `${fmt(currentPrice)} ₺` : "—"}
                </div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, textAlign: "right" }}>{fmt(cost2)} ₺</div>
                <div style={{ fontFamily: "var(--os-mono)", fontSize: 11, textAlign: "right", color: up ? "var(--lz-success)" : "var(--lz-danger)", fontWeight: 600 }}>
                  {up ? "+" : ""}{fmt(pnl)} ₺
                  <div style={{ fontSize: 9, opacity: 0.8 }}>{up ? "+" : ""}{fmt(pnlPct)}%</div>
                </div>
                <button onClick={() => remove(h.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--os-muted)", display: "flex", justifyContent: "center" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
