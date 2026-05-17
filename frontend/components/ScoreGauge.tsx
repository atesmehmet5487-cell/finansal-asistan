"use client";
import { motion } from "framer-motion";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function ScoreGauge({ score, size = "md" }: Props) {
  const dims = { sm: 64, md: 96, lg: 128 };
  const strokes = { sm: 6, md: 8, lg: 10 };

  const dim = dims[size];
  const strokeWidth = strokes[size];
  const radius = (dim - strokeWidth) / 2;
  const cx = dim / 2;
  const cy = dim / 2;

  const circumference = radius * Math.PI;
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const dashOffset = circumference * (1 - pct);

  const color =
    score >= 7 ? "#00FF94"
    : score >= 4 ? "#FFB800"
    : "#FF4545";

  const textSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };
  const subSize = { sm: "text-[8px]", md: "text-xs", lg: "text-sm" };

  return (
    <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-180">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(30,42,58,0.8)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <motion.circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold text-text-primary ${textSize[size]}`} style={{ color }}>
          {score?.toFixed(1)}
        </span>
        <span className={`text-text-muted ${subSize[size]}`}>/10</span>
      </div>
    </div>
  );
}
