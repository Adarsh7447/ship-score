"use client";

import { useEffect, useState } from "react";
import { type AccountStats, type CommitDay, calculateShipScore } from "@/lib/github";
import AccountCard from "./AccountCard";
import ScoreRing from "./ScoreRing";
import HeatMap from "./HeatMap";

interface ApiResponse {
  accounts: AccountStats[];
  fetched_at: string;
}

type ViewMode = "unified" | "work" | "personal";

// === BADGES ===
interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
  check: (s: MergedStats) => boolean;
  tier: "bronze" | "silver" | "gold" | "diamond";
}

interface MergedStats {
  today: number;
  week: number;
  month: number;
  streak: number;
  longestStreak: number;
  repos: number;
  score: number;
  commitDays: CommitDay[];
}

const BADGES: Badge[] = [
  // Daily output
  { id: "first-blood", icon: "\u{1F4A7}", name: "First Blood", description: "Ship at least 1 commit today", check: (s) => s.today >= 1, tier: "bronze" },
  { id: "daily-driver", icon: "\u{1F525}", name: "Daily Driver", description: "5+ commits in a day", check: (s) => s.today >= 5, tier: "silver" },
  { id: "machine-gun", icon: "\u{26A1}", name: "Machine Gun", description: "15+ commits in a day", check: (s) => s.today >= 15, tier: "gold" },
  // Weekly
  { id: "weekly-grind", icon: "\u{1F4AA}", name: "Weekly Grind", description: "30+ commits this week", check: (s) => s.week >= 30, tier: "bronze" },
  { id: "beast-mode", icon: "\u{1F43B}", name: "Beast Mode", description: "70+ commits this week", check: (s) => s.week >= 70, tier: "gold" },
  // Monthly
  { id: "centurion", icon: "\u{1F3C6}", name: "Centurion", description: "100+ commits this month", check: (s) => s.month >= 100, tier: "silver" },
  { id: "triple-century", icon: "\u{1F451}", name: "Triple Century", description: "300+ commits this month", check: (s) => s.month >= 300, tier: "diamond" },
  // Streaks
  { id: "streak-3", icon: "\u{1F4A5}", name: "Hatrick", description: "3-day commit streak", check: (s) => s.streak >= 3, tier: "bronze" },
  { id: "streak-7", icon: "\u{1F5E1}", name: "Week Warrior", description: "7-day commit streak", check: (s) => s.streak >= 7, tier: "silver" },
  { id: "streak-14", icon: "\u{1F30B}", name: "Unstoppable", description: "14-day commit streak", check: (s) => s.streak >= 14, tier: "gold" },
  { id: "streak-30", icon: "\u{1F48E}", name: "Mythic Streak", description: "30-day commit streak", check: (s) => s.streak >= 30, tier: "diamond" },
  // Diversity
  { id: "multi-repo", icon: "\u{1F30D}", name: "Multi-tasker", description: "Ship across 5+ repos", check: (s) => s.repos >= 5, tier: "bronze" },
  { id: "empire", icon: "\u{1F3F0}", name: "Empire Builder", description: "Ship across 10+ repos", check: (s) => s.repos >= 10, tier: "gold" },
  // Score milestones
  { id: "score-500", icon: "\u{2B50}", name: "Rising Star", description: "Reach 500 score", check: (s) => s.score >= 500, tier: "silver" },
  { id: "score-800", icon: "\u{1F31F}", name: "On Fire", description: "Reach 800 score", check: (s) => s.score >= 800, tier: "gold" },
  { id: "score-1000", icon: "\u{1F3C6}", name: "LEGENDARY", description: "Max out at 1000", check: (s) => s.score >= 1000, tier: "diamond" },
  // Special
  { id: "weekend-ship", icon: "\u{1F3D6}", name: "No Days Off", description: "Ship on a weekend", check: (s) => { const d = new Date().getDay(); return (d === 0 || d === 6) && s.today > 0; }, tier: "bronze" },
  { id: "green-wall", icon: "\u{1F7E9}", name: "Green Wall", description: "No gaps in last 14 days", check: (s) => { const last14 = s.commitDays.slice(-14); return last14.length === 14 && last14.every(d => d.count > 0); }, tier: "gold" },
];

const TIER_COLORS: Record<Badge["tier"], { bg: string; border: string; text: string }> = {
  bronze: { bg: "rgba(205,127,50,0.1)", border: "rgba(205,127,50,0.3)", text: "#cd7f32" },
  silver: { bg: "rgba(192,192,192,0.1)", border: "rgba(192,192,192,0.3)", text: "#c0c0c0" },
  gold: { bg: "rgba(255,215,0,0.1)", border: "rgba(255,215,0,0.3)", text: "#ffd700" },
  diamond: { bg: "rgba(185,242,255,0.1)", border: "rgba(185,242,255,0.4)", text: "#b9f2ff" },
};

function BadgeGrid({ stats }: { stats: MergedStats }) {
  const earned = BADGES.filter((b) => b.check(stats));
  const locked = BADGES.filter((b) => !b.check(stats));

  return (
    <div className="bg-zinc-900/30 rounded-xl p-2.5 sm:p-5 border border-zinc-800/30">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Badges
        </h3>
        <span className="text-[10px] sm:text-xs text-zinc-600">
          {earned.length}/{BADGES.length} unlocked
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {earned.map((b) => {
          const tier = TIER_COLORS[b.tier];
          return (
            <div
              key={b.id}
              className="group relative flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] sm:text-xs transition-all"
              style={{ background: tier.bg, borderColor: tier.border, color: tier.text }}
            >
              <span className="text-sm">{b.icon}</span>
              <span className="font-medium">{b.name}</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md text-[9px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                {b.description}
              </div>
            </div>
          );
        })}
        {locked.map((b) => (
          <div
            key={b.id}
            className="group relative flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-800/50 text-[10px] sm:text-xs text-zinc-700 bg-zinc-900/50"
          >
            <span className="text-sm grayscale opacity-40">{b.icon}</span>
            <span className="font-medium">???</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md text-[9px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
              {b.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === SCORE BREAKDOWN ===
function ScoreBreakdown({ stats }: { stats: MergedStats }) {
  const [open, setOpen] = useState(false);

  const todayPts = Math.min(stats.today * 10, 100);
  const weekPts = Math.min(stats.week * 3, 150);
  const monthPts = Math.min(Math.floor(stats.month * 0.5), 100);
  const base = todayPts + weekPts + monthPts;

  const effectiveStreak = Math.max(0, stats.streak - 2);
  const streakMult = 1 + Math.min(effectiveStreak * 0.1, 1.5);

  const diversityMult = 1 + Math.min(stats.repos * 0.02, 0.2);

  const weeklyRate = stats.week / 7;
  const monthlyRate = stats.month / 30;
  const momentumActive = weeklyRate > monthlyRate * 1.5;
  const momentumMult = momentumActive ? 1.15 : 1.0;

  const decayActive = stats.today === 0;
  const decayMult = decayActive ? 0.5 : 1.0;

  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const weekendActive = isWeekend && stats.today > 0;
  const weekendMult = weekendActive ? 1.1 : 1.0;

  const multipliers = [
    { name: "Streak", value: streakMult, active: streakMult > 1, hint: stats.streak < 3 ? "Need 3+ day streak to activate" : `${stats.streak}-day streak active`, color: "#f59e0b" },
    { name: "Diversity", value: diversityMult, active: diversityMult > 1, hint: `${stats.repos} repos (10 for max)`, color: "#8b5cf6" },
    { name: "Momentum", value: momentumMult, active: momentumActive, hint: momentumActive ? "Shipping faster than avg!" : "Ship 1.5x faster than monthly avg", color: "#3b82f6" },
    { name: "Decay", value: decayMult, active: decayActive, hint: decayActive ? "No commits today — score halved!" : "Active today, no decay", color: "#ef4444" },
    { name: "Weekend", value: weekendMult, active: weekendActive, hint: weekendActive ? "Weekend warrior bonus!" : isWeekend ? "Ship today for weekend bonus" : "Available on weekends", color: "#06b6d4" },
  ];

  const nextGoals = [];
  if (stats.today === 0) nextGoals.push("Push 1 commit to remove 0.5x decay penalty");
  if (stats.streak < 3) nextGoals.push(`${3 - stats.streak} more day(s) to unlock streak multiplier`);
  else if (stats.streak < 17) nextGoals.push(`${17 - stats.streak} more day streak for max 2.5x multiplier`);
  if (!momentumActive) nextGoals.push("Ship faster this week to unlock 1.15x momentum");
  if (stats.today < 10) nextGoals.push(`${10 - stats.today} more commits today for max daily points`);
  if (stats.repos < 10) nextGoals.push(`Ship in ${10 - stats.repos} more repos for max diversity`);

  return (
    <div className="bg-zinc-900/30 rounded-xl border border-zinc-800/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2.5 sm:p-5 text-left"
      >
        <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Score Breakdown
        </h3>
        <span className="text-[10px] sm:text-xs text-zinc-600">{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div className="px-2.5 sm:px-5 pb-3 sm:pb-5 space-y-4">
          {/* Base Points */}
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Base Points</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Today", pts: todayPts, max: 100, detail: `${stats.today} x 10` },
                { label: "Week", pts: weekPts, max: 150, detail: `${stats.week} x 3` },
                { label: "Month", pts: monthPts, max: 100, detail: `${stats.month} x 0.5` },
              ].map((item) => (
                <div key={item.label} className="bg-zinc-900/80 rounded-lg p-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] text-zinc-500">{item.label}</span>
                    <span className="text-[10px] font-mono text-zinc-300">{item.pts}/{item.max}</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(item.pts / item.max) * 100}%` }} />
                  </div>
                  <div className="text-[8px] text-zinc-600 mt-1">{item.detail}</div>
                </div>
              ))}
            </div>
            <div className="text-right text-[10px] font-mono text-zinc-400 mt-1">= {base} / 350 base</div>
          </div>

          {/* Multipliers */}
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Multipliers</div>
            <div className="space-y-1.5">
              {multipliers.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div
                    className="w-1 h-4 rounded-full flex-shrink-0"
                    style={{ background: m.active ? m.color : "#27272a" }}
                  />
                  <span className="text-[10px] sm:text-xs text-zinc-400 w-16 sm:w-20">{m.name}</span>
                  <span
                    className="text-[10px] sm:text-xs font-mono font-bold w-10 sm:w-12"
                    style={{ color: m.name === "Decay" && m.active ? "#ef4444" : m.active ? "#10b981" : "#3f3f46" }}
                  >
                    {m.value.toFixed(2)}x
                  </span>
                  <span className="text-[9px] text-zinc-600 truncate">{m.hint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Goals */}
          {nextGoals.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Increase Your Score</div>
              <div className="space-y-1">
                {nextGoals.map((goal, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] sm:text-xs">
                    <span className="text-emerald-500 flex-shrink-0">{"\u25B8"}</span>
                    <span className="text-zinc-400">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formula */}
          <div className="text-[9px] text-zinc-600 font-mono pt-2 border-t border-zinc-800/50">
            {base} x {streakMult.toFixed(1)} x {diversityMult.toFixed(1)} x {momentumMult.toFixed(2)} x {decayMult.toFixed(1)} x {weekendMult.toFixed(1)} = {stats.score}
          </div>
        </div>
      )}
    </div>
  );
}

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
      className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-500 active:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-base sm:text-2xl font-bold font-mono text-white">{value}</span>
      <span className="text-[7px] sm:text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function UnifiedView({ accounts, selectedRepo, onSelectRepo }: { accounts: AccountStats[]; selectedRepo: string | null; onSelectRepo: (r: string | null) => void }) {
  const allRepos = getAllRepos(accounts);
  const maxCommits = allRepos[0]?.commits || 1;
  const totalToday = accounts.reduce((s, a) => s + a.today_commits, 0);
  const totalWeek = accounts.reduce((s, a) => s + a.total_commits_7d, 0);
  const totalMonth = accounts.reduce((s, a) => s + a.total_commits_30d, 0);
  const bestStreak = Math.max(...accounts.map((a) => a.current_streak));
  const totalScore = calculateShipScore({
    total_commits_30d: totalMonth,
    total_commits_7d: totalWeek,
    current_streak: bestStreak,
    today_commits: totalToday,
    top_repos: allRepos,
  });
  const commitDays = mergeCommitDays(accounts);
  const longestStreak = Math.max(...accounts.map((a) => a.longest_streak));

  const mergedStats: MergedStats = {
    today: totalToday,
    week: totalWeek,
    month: totalMonth,
    streak: bestStreak,
    longestStreak,
    repos: allRepos.length,
    score: totalScore,
    commitDays,
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      {/* Score + Stats */}
      <div className="flex flex-col items-center gap-5 sm:gap-8">
        <ScoreRing score={totalScore} size={120} />
        <div className="flex justify-center gap-4 sm:gap-8 w-full">
          <StatItem value={totalToday} label="Today" />
          <StatItem value={totalWeek} label="Week" />
          <StatItem value={totalMonth} label="Month" />
          <StatItem value={`${bestStreak}d`} label="Streak" />
          <StatItem value={allRepos.length} label="Repos" />
        </div>
      </div>

      {/* Badges */}
      <BadgeGrid stats={mergedStats} />

      {/* Score Breakdown */}
      <ScoreBreakdown stats={mergedStats} />

      {/* Heatmap */}
      <div className="bg-zinc-900/30 rounded-xl p-2.5 sm:p-5 border border-zinc-800/30">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">Combined Activity</h3>
          <span className="text-[10px] sm:text-xs text-zinc-600">90 days</span>
        </div>
        <HeatMap days={commitDays} />
      </div>

      {/* Repos */}
      <div>
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <h3 className="text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">All Projects</h3>
          {selectedRepo && (
            <button
              onClick={() => onSelectRepo(null)}
              className="text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-800"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {allRepos.map((repo, i) => {
            const pct = (repo.commits / maxCommits) * 100;
            const isSelected = selectedRepo === repo.full_name;
            const isDimmed = selectedRepo && !isSelected;
            return (
              <button
                key={repo.full_name}
                onClick={() => onSelectRepo(isSelected ? null : repo.full_name)}
                className={`w-full flex items-center gap-1.5 sm:gap-3 px-2 py-1.5 sm:py-2 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-zinc-800 ring-1 ring-emerald-500/40"
                    : isDimmed
                    ? "opacity-30"
                    : "active:bg-zinc-800"
                }`}
              >
                <span className="text-[9px] text-zinc-600 font-mono w-3 text-right flex-shrink-0">{i + 1}</span>
                <span className={`text-[8px] w-4 text-center flex-shrink-0 ${
                  repo.account === "Work" ? "text-blue-400" : "text-purple-400"
                }`}>
                  {repo.account === "Work" ? "W" : "P"}
                </span>
                <span className="text-[11px] text-zinc-300 truncate min-w-0 flex-1" title={repo.full_name}>
                  {repo.name}
                </span>
                <div className="hidden sm:block flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: repo.account === "Work"
                        ? "linear-gradient(90deg, #3b82f680, #3b82f6)"
                        : "linear-gradient(90deg, #a855f780, #a855f7)",
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 w-7 text-right flex-shrink-0">{repo.commits}</span>
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
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-emerald-500/20 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-zinc-300 text-sm">Loading stats...</p>
            <p className="text-zinc-600 text-xs mt-1">Fetching commits</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-red-950/50 border border-red-800/50 rounded-2xl p-5 sm:p-8 max-w-md w-full">
          <h2 className="text-red-400 font-bold mb-2">Something went wrong</h2>
          <p className="text-red-300/80 text-xs sm:text-sm break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const workAccount = data.accounts.find((a) => a.label === "Work");
  const personalAccount = data.accounts.find((a) => a.label === "Personal");

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-10 pb-12 safe-bottom w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-emerald-500 rounded-md sm:rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-[10px] sm:text-sm">S</span>
            </div>
            <span className="text-sm sm:text-2xl font-bold tracking-tight">
              Ship<span className="text-emerald-500">Score</span>
            </span>
          </div>
        </div>

        {data.accounts.length > 1 && (
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 w-fit">
            {(["unified", "work", "personal"] as const).map((v) => (
              <TabButton
                key={v}
                active={view === v}
                onClick={() => { setView(v); setSelectedRepo(null); }}
              >
                {v === "unified" ? "All" : v === "work" ? "Work" : "Me"}
              </TabButton>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {view === "unified" && (
        <UnifiedView accounts={data.accounts} selectedRepo={selectedRepo} onSelectRepo={setSelectedRepo} />
      )}

      {view === "work" && workAccount && (
        <AccountCard stats={workAccount} />
      )}

      {view === "personal" && personalAccount && (
        <AccountCard stats={personalAccount} />
      )}

      {/* Account cards below unified */}
      {view === "unified" && data.accounts.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          {data.accounts.map((account) => (
            <div key={account.username} className="overflow-hidden">
              <AccountCard stats={account} />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 sm:mt-12 text-[10px] sm:text-xs text-zinc-700">
        {new Date(data.fetched_at).toLocaleString()}
      </div>
    </div>
  );
}
