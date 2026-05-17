"use client";
import { useEffect, useState } from "react";
import NewsCard from "@/components/NewsCard";
import { Newspaper } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CATEGORIES = [
  { key: "all", label: "Tümü" },
  { key: "critical", label: "🚨 Kritik" },
  { key: "bist", label: "📈 BIST" },
  { key: "emtia", label: "🏅 Emtia" },
  { key: "makro", label: "🌍 Makro" },
];

export default function NewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/news/feed?category=${category}&limit=50`)
      .then(r => r.json())
      .then(d => { setNews(d.news || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-accent-cyan" />
        <h1 className="text-xl font-bold text-text-primary">Haber Merkezi</h1>
      </div>

      {/* Kategori filtreleri */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-4 py-1.5 rounded-full text-sm transition-all border ${
              category === cat.key
                ? "bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan"
                : "border-border text-text-secondary hover:border-border-accent"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Haberler */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))
        ) : news.length === 0 ? (
          <div className="card text-center py-12 text-text-secondary">
            Bu kategoride haber bulunamadı.
          </div>
        ) : (
          news.map((item, i) => <NewsCard key={i} news={item} />)
        )}
      </div>
    </div>
  );
}
