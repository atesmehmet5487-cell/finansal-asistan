"use client";
import { useEffect, useRef } from "react";

interface Props {
  symbol: string;
}

export default function TradingChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: any;

    const initChart = async () => {
      const { createChart, ColorType } = await import("lightweight-charts");

      chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#94A3B8",
        },
        grid: {
          vertLines: { color: "rgba(30, 42, 58, 0.5)" },
          horzLines: { color: "rgba(30, 42, 58, 0.5)" },
        },
        crosshair: {
          vertLine: { color: "#00D4FF44" },
          horzLine: { color: "#00D4FF44" },
        },
        rightPriceScale: {
          borderColor: "rgba(30, 42, 58, 0.5)",
        },
        timeScale: {
          borderColor: "rgba(30, 42, 58, 0.5)",
          timeVisible: true,
        },
        width: containerRef.current!.clientWidth,
        height: 300,
      });

      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#00FF94",
        downColor: "#FF4545",
        borderUpColor: "#00FF94",
        borderDownColor: "#FF4545",
        wickUpColor: "#00FF9480",
        wickDownColor: "#FF454580",
      });

      try {
        const yf_sym = symbol.includes(".") || symbol.includes("=") ? symbol : `${symbol}.IS`;
        const resp = await fetch(`${API}/api/v1/assets/${symbol}/technical`);
        if (!resp.ok) throw new Error("no data");

        const fallbackData = generateMockData();
        candleSeries.setData(fallbackData);
      } catch {
        candleSeries.setData(generateMockData());
      }

      chart.timeScale().fitContent();
    };

    initChart();

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Fiyat Grafiği
        </h3>
        <span className="text-xs text-text-muted">Günlük | 1 Yıl</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

function generateMockData() {
  const data = [];
  let price = 100 + Math.random() * 900;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 250; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.02;
    const open = price;
    const close = Math.max(price + change, 1);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    data.push({
      time: (now - i * 86400) as any,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
    price = close;
  }
  return data;
}
