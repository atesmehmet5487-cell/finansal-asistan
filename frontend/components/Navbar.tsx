"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Activity, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const handleSelect = (symbol: string) => {
    setQuery("");
    setOpen(false);
    router.push(`/${symbol}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[0].symbol);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Activity className="w-5 h-5 text-accent-cyan" />
          <span className="font-semibold text-text-primary hidden sm:block">
            Finansal Asistan
          </span>
        </Link>

        {/* Arama */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-3 py-2 focus-within:border-accent-cyan/50 transition-colors">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ASELS, THYAO, ALTIN..."
              className="bg-transparent flex-1 text-sm text-text-primary placeholder-text-muted outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setOpen(false); }}>
                <X className="w-4 h-4 text-text-muted hover:text-text-primary" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              {results.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(item.symbol)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent-cyan/5 text-left transition-colors"
                >
                  <div>
                    <div className="font-medium text-text-primary text-sm">{item.symbol}</div>
                    <div className="text-xs text-text-secondary">{item.name}</div>
                  </div>
                  <div className="text-right">
                    {item.price && (
                      <div className="font-mono text-sm text-text-primary">
                        {item.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    {item.change_pct !== null && (
                      <div className={`text-xs font-mono ${item.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
                        {item.change_pct >= 0 ? "+" : ""}{item.change_pct?.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Linkler */}
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <Link href="/news" className="hover:text-text-primary transition-colors hidden sm:block">
            Haberler
          </Link>
        </div>
      </div>
    </nav>
  );
}
