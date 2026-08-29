"use client";

import { type AccountStats } from "@/lib/github";
import HeatMap from "./HeatMap";
import ScoreRing from "./ScoreRing";

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AccountCard({ stats }: { stats: AccountStats }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={stats.avatar_url}
            alt={stats.username}
            className="w-14 h-14 rounded-full border-2 border-zinc-700"
          />
          <div>
            <h2 className="text-xl font-bold">{stats.username}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {stats.label}
            </span>
          </div>
        </div>
        <ScoreRing score={stats.ship_score} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Today" value={stats.today_commits} />
        <StatBox label="This Week" value={stats.total_commits_7d} />
        <StatBox label="This Month" value={stats.total_commits_30d} />
        <StatBox
          label="Streak"
          value={`${stats.current_streak}d`}
          sub={`Best: ${stats.longest_streak}d`}
        />
      </div>

      {/* Heatmap */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Last 90 Days</h3>
        <HeatMap days={stats.commit_days} />
      </div>

      {/* Top Repos */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Top Projects</h3>
        <div className="space-y-2">
          {stats.top_repos.slice(0, 5).map((repo) => {
            const maxCommits = stats.top_repos[0]?.commits || 1;
            const pct = (repo.commits / maxCommits) * 100;
            return (
              <div key={repo.full_name} className="flex items-center gap-3">
                <div className="w-40 truncate text-sm text-zinc-300" title={repo.full_name}>
                  {repo.name}
                </div>
                <div className="flex-1 h-5 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-400 w-12 text-right">
                  {repo.commits}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
