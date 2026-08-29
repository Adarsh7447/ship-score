"use client";

import { useState, useRef, useEffect } from "react";
import { type CommitDay } from "@/lib/github";

function getColor(count: number): string {
  if (count === 0) return "#161616";
  if (count === 1) return "#0e4429";
  if (count <= 3) return "#006d32";
  if (count <= 6) return "#26a641";
  return "#39d353";
}

export default function HeatMap({ days }: { days: CommitDay[] }) {
  const [selected, setSelected] = useState<CommitDay | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(12);
  const [gap, setGap] = useState(3);

  const weeks: CommitDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const numWeeks = weeks.length;

  useEffect(() => {
    function calcSize() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const maxCellWithGap = width / numWeeks;
      const g = Math.max(2, Math.min(3, Math.floor(maxCellWithGap * 0.15)));
      const c = Math.floor(maxCellWithGap - g);
      setCellSize(Math.max(8, Math.min(20, c)));
      setGap(g);
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, [numWeeks]);

  // Month labels positioned by week index
  const months: { label: string; weekIdx: number }[] = [];
  let lastMonth = "";
  weeks.forEach((week, wi) => {
    if (week[0]) {
      const m = new Date(week[0].date).toLocaleString("en", { month: "short" });
      if (m !== lastMonth) {
        months.push({ label: m, weekIdx: wi });
        lastMonth = m;
      }
    }
  });

  return (
    <div className="flex flex-col gap-1 w-full" ref={containerRef}>
      {/* Selected day info */}
      {selected && (
        <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-1.5 mb-1">
          <span className="text-xs text-zinc-300">
            <span className="font-bold">{selected.count}</span> commits on {selected.date}
          </span>
          <button onClick={() => setSelected(null)} className="text-zinc-500 text-xs ml-2">x</button>
        </div>
      )}

      {/* Month labels row */}
      <div className="flex" style={{ gap }}>
        {weeks.map((_, wi) => {
          const month = months.find((m) => m.weekIdx === wi);
          return (
            <div key={wi} style={{ width: cellSize, flexShrink: 0 }}>
              {month && (
                <span className="text-[9px] sm:text-[10px] text-zinc-500">{month.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid rows (one per day of week) */}
      {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
        <div key={dayIdx} className="flex" style={{ gap }}>
          {weeks.map((week, wi) => {
            const day = week[dayIdx];
            if (!day) return <div key={wi} style={{ width: cellSize, height: cellSize }} />;
            const isSelected = selected?.date === day.date;
            return (
              <div
                key={day.date}
                onClick={() => setSelected(isSelected ? null : day)}
                className={`rounded-[2px] cursor-pointer flex-shrink-0 ${
                  isSelected ? "ring-1 ring-white scale-110 z-10" : ""
                }`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: getColor(day.count),
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[9px] text-zinc-600">Less</span>
        {[0, 1, 3, 6, 10].map((n) => (
          <div
            key={n}
            className="rounded-[2px]"
            style={{ width: Math.max(8, cellSize * 0.7), height: Math.max(8, cellSize * 0.7), backgroundColor: getColor(n) }}
          />
        ))}
        <span className="text-[9px] text-zinc-600">More</span>
      </div>
    </div>
  );
}
