"use client";

import { type AccountStats } from "@/lib/github";
import HeatMap from "./HeatMap";
import ScoreRing from "./ScoreRing";
import { getScoreTheme } from "./ScoreRing";

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-zinc-900/50 rounded-lg px-1 py-2 border border-zinc-800/50 min-w-0">
      <span className="text-base sm:text-xl font-bold font-mono text-white">{value}</span>
      <span className="text-[8px] sm:text-[10px] text-zinc-500 uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

export default function AccountCard({ stats }: { stats: AccountStats }) {
  const theme = getScoreTheme(stats.ship_score);
  const maxCommits = stats.top_repos[0]?.commits || 1;

  return (
    <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800/60 overflow-hidden w-full max-w-[100vw]">
      {/* Top accent line */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)` }} />

      <div className="p-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={stats.avatar_url}
                alt={stats.username}
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2"
                style={{ borderColor: theme.color + "40" }}
              />
              <div
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[7px] sm:text-[10px] font-bold border-2 border-zinc-950 text-white"
                style={{ background: theme.color }}
              >
                {stats.label === "Work" ? "W" : "P"}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-lg font-bold text-white truncate max-w-[120px] sm:max-w-none">{stats.username}</h2>
              <span className="text-[10px] sm:text-xs text-zinc-500">{stats.label}</span>
            </div>
          </div>
          <ScoreRing score={stats.ship_score} size={70} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          <StatCard value={stats.today_commits} label="Today" />
          <StatCard value={stats.total_commits_7d} label="Week" />
          <StatCard value={stats.total_commits_30d} label="Month" />
          <StatCard value={`${stats.current_streak}d`} label={`Best ${stats.longest_streak}d`} />
        </div>

        {/* Heatmap */}
        <div className="bg-zinc-900/30 rounded-xl p-2 sm:p-4 border border-zinc-800/30">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">Activity</h3>
            <span className="text-[10px] sm:text-xs text-zinc-600">90 days</span>
          </div>
          <HeatMap days={stats.commit_days} />
        </div>

        {/* Top Repos */}
        {stats.top_repos.length > 0 && (
          <div>
            <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 sm:mb-3">
              Top Projects
            </h3>
            <div className="space-y-2">
              {stats.top_repos.slice(0, 5).map((repo, i) => {
                const pct = (repo.commits / maxCommits) * 100;
                return (
                  <div key={repo.full_name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] text-zinc-600 font-mono w-3 flex-shrink-0">{i + 1}</span>
                        <span className="text-xs sm:text-sm text-zinc-300 truncate" title={repo.full_name}>
                          {repo.name}
                        </span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono text-zinc-400 flex-shrink-0 ml-2">{repo.commits}</span>
                    </div>
                    <div className="ml-4 h-1 sm:h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${theme.color}80, ${theme.color})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
