"use client";

import { type CommitDay } from "@/lib/github";

function getColor(count: number): string {
  if (count === 0) return "#161616";
  if (count === 1) return "#0e4429";
  if (count <= 3) return "#006d32";
  if (count <= 6) return "#26a641";
  return "#39d353";
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export default function HeatMap({ days, accentColor }: { days: CommitDay[]; accentColor?: string }) {
  // Build weeks (columns) from days
  const weeks: CommitDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Month labels
  const months: { label: string; col: number }[] = [];
  let lastMonth = "";
  weeks.forEach((week, wi) => {
    if (week[0]) {
      const m = new Date(week[0].date).toLocaleString("en", { month: "short" });
      if (m !== lastMonth) {
        months.push({ label: m, col: wi });
        lastMonth = m;
      }
    }
  });

  return (
    <div className="flex flex-col gap-1">
      {/* Month labels */}
      <div className="flex ml-8 gap-0">
        {months.map((m, i) => (
          <span
            key={i}
            className="text-[10px] text-zinc-500"
            style={{ marginLeft: i === 0 ? m.col * 15 : (m.col - (months[i - 1]?.col || 0)) * 15 - 20 }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mr-2 justify-start">
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="text-[10px] text-zinc-600 h-[12px] leading-[12px]">
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  className="w-[12px] h-[12px] rounded-[2px] transition-all hover:scale-150 cursor-pointer relative group"
                  style={{ backgroundColor: getColor(day.count) }}
                  title={`${day.count} commits on ${day.date}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 ml-8 mt-1">
        <span className="text-[10px] text-zinc-600">Less</span>
        {[0, 1, 3, 6, 10].map((n) => (
          <div
            key={n}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ backgroundColor: getColor(n) }}
          />
        ))}
        <span className="text-[10px] text-zinc-600">More</span>
      </div>
    </div>
  );
}
