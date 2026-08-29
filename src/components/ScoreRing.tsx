"use client";

function getScoreTheme(score: number): { color: string; bg: string; label: string } {
  if (score >= 800) return { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "ON FIRE" };
  if (score >= 600) return { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "SHIPPING" };
  if (score >= 400) return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "BUILDING" };
  if (score >= 200) return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "WARMING UP" };
  if (score > 0) return { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "STARTING" };
  return { color: "#374151", bg: "rgba(55,65,81,0.1)", label: "IDLE" };
}

export default function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const maxScore = 1000;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - progress);
  const theme = getScoreTheme(score);
  const fontSize = Math.max(size * 0.2, 14);

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-20"
          style={{ background: theme.color }}
        />
        <svg width={size} height={size} className="-rotate-90 relative">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth={Math.max(size * 0.05, 4)}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.color}
            strokeWidth={Math.max(size * 0.05, 4)}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${theme.color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold leading-none"
            style={{ color: theme.color, fontSize }}
          >
            {score}
          </span>
          <span className="text-[9px] text-zinc-500 mt-0.5">/ {maxScore}</span>
        </div>
      </div>
      <span
        className="text-[10px] font-bold tracking-[0.15em] uppercase"
        style={{ color: theme.color }}
      >
        {theme.label}
      </span>
    </div>
  );
}

export { getScoreTheme };
