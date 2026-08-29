"use client";

function getScoreColor(score: number): string {
  if (score >= 800) return "#10b981"; // emerald
  if (score >= 600) return "#22c55e"; // green
  if (score >= 400) return "#eab308"; // yellow
  if (score >= 200) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getScoreLabel(score: number): string {
  if (score >= 800) return "ON FIRE";
  if (score >= 600) return "SHIPPING";
  if (score >= 400) return "CRUISING";
  if (score >= 200) return "WARMING UP";
  return "IDLE";
}

export default function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const maxScore = 1000;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - progress);
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <span
        className="text-xs font-bold tracking-widest"
        style={{ color }}
      >
        {getScoreLabel(score)}
      </span>
    </div>
  );
}
