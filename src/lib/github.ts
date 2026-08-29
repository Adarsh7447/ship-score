export interface GitHubAccount {
  username: string;
  label: string;
  token: string;
}

export interface CommitDay {
  date: string;
  count: number;
}

export interface RepoStats {
  name: string;
  full_name: string;
  commits: number;
  last_pushed: string;
  language: string | null;
  is_private: boolean;
}

export interface AccountStats {
  username: string;
  label: string;
  avatar_url: string;
  total_commits_30d: number;
  total_commits_7d: number;
  current_streak: number;
  longest_streak: number;
  today_commits: number;
  commit_days: CommitDay[];
  top_repos: RepoStats[];
  ship_score: number;
}

async function ghFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${url}`);
  return res.json();
}

function getDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function calculateStreaks(commitDays: CommitDay[]): {
  current: number;
  longest: number;
} {
  const dateSet = new Set(commitDays.filter((d) => d.count > 0).map((d) => d.date));
  const today = new Date();

  // Current streak (counting back from today)
  let current = 0;
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (dateSet.has(ds)) {
      current++;
    } else if (i > 0) {
      break;
    }
  }

  // Longest streak in the window
  let longest = 0;
  let streak = 0;
  const sorted = [...commitDays].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].count > 0) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
    }
  }

  return { current, longest };
}

function calculateShipScore(stats: {
  total_commits_30d: number;
  total_commits_7d: number;
  current_streak: number;
  today_commits: number;
  top_repos: RepoStats[];
}): number {
  // Score components (max 1000)
  const volumeScore = Math.min(stats.total_commits_30d * 2, 300); // max 300
  const velocityScore = Math.min(stats.total_commits_7d * 8, 250); // max 250
  const streakScore = Math.min(stats.current_streak * 20, 200); // max 200
  const todayBonus = stats.today_commits > 0 ? 100 : 0; // max 100
  const diversityScore = Math.min(stats.top_repos.length * 15, 150); // max 150

  return Math.round(volumeScore + velocityScore + streakScore + todayBonus + diversityScore);
}

export async function fetchAccountStats(account: GitHubAccount): Promise<AccountStats> {
  const { username, label, token } = account;

  // Fetch user profile
  const user = await ghFetch(`https://api.github.com/users/${username}`, token);

  // Fetch recent events (last 90 days of push events)
  const since = getDaysAgo(90);
  const commitsByDate: Record<string, number> = {};
  const repoCommits: Record<string, { count: number; full_name: string; language: string | null; is_private: boolean; last_pushed: string }> = {};

  // GitHub events API returns last 90 days, paginated
  for (let page = 1; page <= 10; page++) {
    const events = await ghFetch(
      `https://api.github.com/users/${username}/events?per_page=100&page=${page}`,
      token
    );
    if (events.length === 0) break;

    for (const event of events) {
      if (event.type !== "PushEvent") continue;

      const date = event.created_at.split("T")[0];
      if (date < since) continue;

      const numCommits = event.payload?.commits?.length || 0;
      commitsByDate[date] = (commitsByDate[date] || 0) + numCommits;

      const repoName = event.repo?.name || "unknown";
      if (!repoCommits[repoName]) {
        repoCommits[repoName] = {
          count: 0,
          full_name: repoName,
          language: null,
          is_private: event.repo?.public === false,
          last_pushed: date,
        };
      }
      repoCommits[repoName].count += numCommits;
      if (date > repoCommits[repoName].last_pushed) {
        repoCommits[repoName].last_pushed = date;
      }
    }
  }

  // Build commit_days array for last 90 days
  const commitDays: CommitDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = getDaysAgo(i);
    commitDays.push({ date, count: commitsByDate[date] || 0 });
  }

  const today = toDateStr(new Date());
  const sevenDaysAgo = getDaysAgo(7);
  const thirtyDaysAgo = getDaysAgo(30);

  const total_commits_7d = commitDays
    .filter((d) => d.date >= sevenDaysAgo)
    .reduce((sum, d) => sum + d.count, 0);
  const total_commits_30d = commitDays
    .filter((d) => d.date >= thirtyDaysAgo)
    .reduce((sum, d) => sum + d.count, 0);
  const today_commits = commitsByDate[today] || 0;

  const streaks = calculateStreaks(commitDays);

  const top_repos: RepoStats[] = Object.entries(repoCommits)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({
      name: name.split("/").pop() || name,
      full_name: data.full_name,
      commits: data.count,
      last_pushed: data.last_pushed,
      language: data.language,
      is_private: data.is_private,
    }));

  const ship_score = calculateShipScore({
    total_commits_30d,
    total_commits_7d,
    current_streak: streaks.current,
    today_commits,
    top_repos,
  });

  return {
    username,
    label,
    avatar_url: user.avatar_url,
    total_commits_30d,
    total_commits_7d,
    current_streak: streaks.current,
    longest_streak: streaks.longest,
    today_commits,
    commit_days: commitDays,
    top_repos,
    ship_score,
  };
}
