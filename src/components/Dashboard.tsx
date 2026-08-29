"use client";

import { useEffect, useState } from "react";
import { type AccountStats } from "@/lib/github";
import AccountCard from "./AccountCard";
import ScoreRing from "./ScoreRing";
import HeatMap from "./HeatMap";
import { type CommitDay } from "@/lib/github";

interface ApiResponse {
  accounts: AccountStats[];
  fetched_at: string;
}

type ViewMode = "unified" | "work" | "personal";

function mergeCommitDays(accounts: AccountStats[]): CommitDay[] {
  const merged: Record<string, number> = {};
  for (const a of accounts) {
    for (const d of a.commit_days) {
      merged[d.date] = (merged[d.date] || 0) + d.count;
    }
  }
  return Object.entries(merged)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

function getAllRepos(accounts: AccountStats[]) {
  const repoMap: Record<string, { name: string; full_name: string; commits: number; last_pushed: string; language: string | null; is_private: boolean; account: string }> = {};
  for (const a of accounts) {
    for (const r of a.top_repos) {
      const key = r.full_name;
      if (!repoMap[key]) {
        repoMap[key] = { ...r, account: a.label };
      } else {
        repoMap[key].commits += r.commits;
      }
    }
  }
  return Object.values(repoMap).sort((a, b) => b.commits - a.commits);
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-500 hover:text-zinc-300 active:bg-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl sm:text-2xl font-bold font-mono text-white">{value}</span>
      <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function UnifiedView({ accounts, selectedRepo, onSelectRepo }: { accounts: AccountStats[]; selectedRepo: string | null; onSelectRepo: (r: string | null) => void }) {
  const allRepos = getAllRepos(accounts);
  const maxCommits = allRepos[0]?.commits || 1;

  const totalToday = accounts.reduce((s, a) => s + a.today_commits, 0);
  const totalWeek = accounts.reduce((s, a) => s + a.total_commits_7d, 0);
  const totalMonth = accounts.reduce((s, a) => s + a.total_commits_30d, 0);
  const totalScore = accounts.reduce((s, a) => s + a.ship_score, 0);
  const bestStreak = Math.max(...accounts.map((a) => a.current_streak));
  const commitDays = mergeCommitDays(accounts);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-fade-in-up">
      {/* Score + Stats */}
      <div className="flex flex-col items-center gap-6 sm:gap-8">
        <ScoreRing score={totalScore} size={160} />
        <div className="grid grid-cols-5 gap-4 sm:gap-8 w-full max-w-md">
          <StatItem value={totalToday} label="Today" />
          <StatItem value={totalWeek} label="Week" />
          <StatItem value={totalMonth} label="Month" />
          <StatItem value={`${bestStreak}d`} label="Streak" />
          <StatItem value={allRepos.length} label="Repos" />
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-zinc-900/30 rounded-xl p-3 sm:p-5 border border-zinc-800/30">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">Combined Activity</h3>
          <span className="text-[11px] sm:text-xs text-zinc-600">Last 90 days</span>
        </div>
        <HeatMap days={commitDays} />
      </div>

      {/* Repos Table */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">All Projects</h3>
          {selectedRepo && (
            <button
              onClick={() => onSelectRepo(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded bg-zinc-800"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {allRepos.map((repo, i) => {
            const pct = (repo.commits / maxCommits) * 100;
            const isSelected = selectedRepo === repo.full_name;
            const isDimmed = selectedRepo && !isSelected;
            return (
              <button
                key={repo.full_name}
                onClick={() => onSelectRepo(isSelected ? null : repo.full_name)}
                className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-zinc-800 ring-1 ring-emerald-500/40"
                    : isDimmed
                    ? "opacity-30"
                    : "active:bg-zinc-800 sm:hover:bg-zinc-900"
                }`}
              >
                <span className="text-[10px] text-zinc-600 font-mono w-4 sm:w-5 text-right flex-shrink-0">{i + 1}</span>
                <span className="text-xs sm:text-sm text-zinc-300 truncate min-w-0 flex-1" title={repo.full_name}>
                  {repo.name}
                </span>
                <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline ${
                  repo.account === "Work" ? "bg-blue-900/40 text-blue-400" : "bg-purple-900/40 text-purple-400"
                }`}>
                  {repo.account}
                </span>
                <div className="w-16 sm:flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: repo.account === "Work"
                        ? "linear-gradient(90deg, #3b82f680, #3b82f6)"
                        : "linear-gradient(90deg, #a855f780, #a855f7)",
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-400 w-8 sm:w-10 text-right flex-shrink-0">{repo.commits}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("unified");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 border-4 border-emerald-500/20 rounded-full" />
            <div className="absolute inset-0 w-14 h-14 sm:w-16 sm:h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-zinc-300 text-sm font-medium">Loading your stats...</p>
            <p className="text-zinc-600 text-xs mt-1">Fetching commits across all repos</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-red-950/50 border border-red-800/50 rounded-2xl p-6 sm:p-8 max-w-md w-full">
          <h2 className="text-red-400 font-bold text-lg mb-2">Something went wrong</h2>
          <p className="text-red-300/80 text-sm break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const workAccount = data.accounts.find((a) => a.label === "Work");
  const personalAccount = data.accounts.find((a) => a.label === "Personal");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-between mb-8 sm:mb-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs sm:text-sm">S</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Ship<span className="text-emerald-500">Score</span>
          </h1>
        </div>

        {/* View Toggle + Refresh */}
        <div className="flex items-center gap-2 sm:gap-4">
          {data.accounts.length > 1 && (
            <div className="flex items-center gap-0.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
              <TabButton active={view === "unified"} onClick={() => { setView("unified"); setSelectedRepo(null); }}>
                All
              </TabButton>
              <TabButton active={view === "work"} onClick={() => { setView("work"); setSelectedRepo(null); }}>
                Work
              </TabButton>
              <TabButton active={view === "personal"} onClick={() => { setView("personal"); setSelectedRepo(null); }}>
                Personal
              </TabButton>
            </div>
          )}

          <button
            onClick={() => { setLoading(true); window.location.reload(); }}
            className="text-xs text-zinc-600 hover:text-zinc-300 active:text-zinc-300 transition-colors px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "unified" && (
        <UnifiedView accounts={data.accounts} selectedRepo={selectedRepo} onSelectRepo={setSelectedRepo} />
      )}

      {view === "work" && workAccount && (
        <div className="max-w-2xl mx-auto animate-fade-in-up">
          <AccountCard stats={workAccount} />
        </div>
      )}

      {view === "personal" && personalAccount && (
        <div className="max-w-2xl mx-auto animate-fade-in-up">
          <AccountCard stats={personalAccount} />
        </div>
      )}

      {/* Side-by-side comparison in unified view */}
      {view === "unified" && data.accounts.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          {data.accounts.map((account) => (
            <div key={account.username} className="animate-fade-in-up-delay-2">
              <AccountCard stats={account} />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-10 sm:mt-12 text-xs text-zinc-700">
        Last updated {new Date(data.fetched_at).toLocaleString()}
      </div>
    </div>
  );
}
