"use client";
import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  price?: number | null;
  changePct?: number | null;
  volume?: number | null;
  compact?: boolean;
}

export default function PriceCard({ price, changePct, volume, compact }: Props) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    if (price && prevPrice.current !== null) {
      if (price > prevPrice.current) setFlash("up");
      else if (price < prevPrice.current) setFlash("down");
    }
    prevPrice.current = price ?? null;

    if (flash) {
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
  }, [price]);

  const isPositive = (changePct ?? 0) >= 0;
  const Icon = changePct === 0 ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className={`transition-colors duration-300 rounded-lg ${
        flash === "up" ? "flash-green" : flash === "down" ? "flash-red" : ""
      }`}
    >
      <div className={`flex items-end gap-3 ${compact ? "" : "flex-wrap"}`}>
        <div>
          {!compact && (
            <div className="text-xs text-text-muted mb-1">Güncel Fiyat</div>
          )}
          <div className={`font-mono font-bold text-text-primary ${compact ? "text-xl" : "text-3xl"}`}>
            {price != null
              ? price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "—"}
          </div>
        </div>

        {changePct != null && (
          <div
            className={`flex items-center gap-1 font-mono text-sm px-2 py-1 rounded-md ${
              isPositive ? "text-positive bg-positive/10" : "text-negative bg-negative/10"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {isPositive ? "+" : ""}{changePct.toFixed(2)}%
          </div>
        )}
      </div>

      {!compact && volume != null && (
        <div className="text-xs text-text-muted mt-2">
          Hacim: {volume.toLocaleString("tr-TR")}
        </div>
      )}
    </div>
  );
}
