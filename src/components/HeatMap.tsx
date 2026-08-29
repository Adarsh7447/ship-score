"use client";

import { type CommitDay } from "@/lib/github";

function getColor(count: number): string {
  if (count === 0) return "bg-zinc-800";
  if (count <= 2) return "bg-emerald-900";
  if (count <= 5) return "bg-emerald-700";
  if (count <= 10) return "bg-emerald-500";
  return "bg-emerald-400";
}

export default function HeatMap({ days }: { days: CommitDay[] }) {
  // Show last 90 days in a grid (13 weeks x 7 days)
  const weeks: CommitDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex gap-[3px]">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((day) => (
            <div
              key={day.date}
              className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-all hover:ring-1 hover:ring-emerald-400`}
              title={`${day.date}: ${day.count} commits`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
