"use client";

import { useEffect, useState } from "react";
import { type AccountStats } from "@/lib/github";
import AccountCard from "./AccountCard";
import ScoreRing from "./ScoreRing";

interface ApiResponse {
  accounts: AccountStats[];
  fetched_at: string;
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Fetching your commits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-950 border border-red-800 rounded-xl p-6 max-w-md">
          <h2 className="text-red-400 font-bold mb-2">Error</h2>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalScore = data.accounts.reduce((sum, a) => sum + a.ship_score, 0);
  const totalToday = data.accounts.reduce((sum, a) => sum + a.today_commits, 0);
  const totalWeek = data.accounts.reduce((sum, a) => sum + a.total_commits_7d, 0);
  const totalMonth = data.accounts.reduce((sum, a) => sum + a.total_commits_30d, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">
          Ship<span className="text-emerald-500">Score</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-2">Ship fast. Ship often.</p>
      </div>

      {/* Combined Score */}
      {data.accounts.length > 1 && (
        <div className="flex flex-col items-center mb-10">
          <ScoreRing score={totalScore} size={180} />
          <div className="flex gap-8 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalToday}</div>
              <div className="text-xs text-zinc-500">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalWeek}</div>
              <div className="text-xs text-zinc-500">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalMonth}</div>
              <div className="text-xs text-zinc-500">This Month</div>
            </div>
          </div>
        </div>
      )}

      {/* Account Cards */}
      <div className={`grid gap-6 ${data.accounts.length > 1 ? "md:grid-cols-2" : "max-w-2xl mx-auto"}`}>
        {data.accounts.map((account) => (
          <AccountCard key={account.username} stats={account} />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-10 text-xs text-zinc-600">
        Last fetched: {new Date(data.fetched_at).toLocaleString()}
      </div>
    </div>
  );
}
