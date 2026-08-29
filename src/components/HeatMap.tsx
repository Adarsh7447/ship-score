"use client";

import { useState } from "react";
import { type CommitDay } from "@/lib/github";

function getColor(count: number): string {
  if (count === 0) return "#161616";
  if (count === 1) return "#0e4429";
  if (count <= 3) return "#006d32";
  if (count <= 6) return "#26a641";
  return "#39d353";
}

const DAY_LABELS = ["", "M", "", "W", "", "F", ""];

export default function HeatMap({ days }: { days: CommitDay[] }) {
  const [selected, setSelected] = useState<CommitDay | null>(null);

  const weeks: CommitDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

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
      {/* Selected day info bar */}
      {selected && (
        <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-1.5 mb-1">
          <span className="text-xs text-zinc-300">
            <span className="font-bold">{selected.count}</span> commits on {selected.date}
          </span>
          <button
            onClick={() => setSelected(null)}
            className="text-zinc-500 text-xs ml-2"
          >
            x
          </button>
        </div>
      )}

      {/* Scrollable heatmap */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        {/* Month labels */}
        <div className="flex ml-6 gap-0 min-w-max">
          {months.map((m, i) => (
            <span
              key={i}
              className="text-[9px] text-zinc-500"
              style={{ marginLeft: i === 0 ? m.col * 13 : (m.col - (months[i - 1]?.col || 0)) * 13 - 18 }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex gap-0 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-1 justify-start">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="text-[9px] text-zinc-600 h-[10px] leading-[10px] w-4 text-right">
                {label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day) => {
                  const isSelected = selected?.date === day.date;
                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelected(isSelected ? null : day)}
                      className={`w-[10px] h-[10px] rounded-[2px] cursor-pointer transition-transform ${
                        isSelected ? "ring-1 ring-white scale-150 z-10" : ""
                      }`}
                      style={{ backgroundColor: getColor(day.count) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 ml-6 mt-1">
        <span className="text-[9px] text-zinc-600">Less</span>
        {[0, 1, 3, 6, 10].map((n) => (
          <div
            key={n}
            className="w-[8px] h-[8px] rounded-[2px]"
            style={{ backgroundColor: getColor(n) }}
          />
        ))}
        <span className="text-[9px] text-zinc-600">More</span>
      </div>
    </div>
  );
}
