import { NextResponse } from "next/server";
import { fetchAccountStats, calculateShipScore, type GitHubAccount, type AccountStats } from "@/lib/github";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts: GitHubAccount[] = [];

  if (process.env.GITHUB_WORK_TOKEN && process.env.GITHUB_WORK_USERNAME) {
    const workEmails = process.env.GITHUB_WORK_AUTHOR_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean);
    accounts.push({
      username: process.env.GITHUB_WORK_USERNAME,
      label: "Work",
      token: process.env.GITHUB_WORK_TOKEN,
      authorEmail: workEmails ? undefined : process.env.GITHUB_WORK_AUTHOR_EMAIL,
      authorEmails: workEmails,
      org: process.env.GITHUB_WORK_ORG,
    });
  }

  if (process.env.GITHUB_PERSONAL_TOKEN && process.env.GITHUB_PERSONAL_USERNAME) {
    const personalEmails = process.env.GITHUB_PERSONAL_AUTHOR_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean);
    accounts.push({
      username: process.env.GITHUB_PERSONAL_USERNAME,
      label: "Personal",
      token: process.env.GITHUB_PERSONAL_TOKEN,
      authorEmail: personalEmails ? undefined : process.env.GITHUB_PERSONAL_AUTHOR_EMAIL,
      authorEmails: personalEmails,
      org: process.env.GITHUB_PERSONAL_ORG,
    });
  }

  if (accounts.length === 0) {
    return NextResponse.json({ error: "No accounts configured" }, { status: 500 });
  }

  try {
    const stats = await Promise.all(accounts.map(fetchAccountStats));

    // Find the most recent commit across all accounts
    let lastCommitDate: Date | null = null;
    for (const account of stats) {
      for (const day of [...account.commit_days].reverse()) {
        if (day.count > 0) {
          const d = new Date(day.date + "T23:59:59Z");
          if (!lastCommitDate || d > lastCommitDate) {
            lastCommitDate = d;
          }
          break;
        }
      }
    }

    // Compute unified score from merged stats
    const totalToday = stats.reduce((s, a) => s + a.today_commits, 0);
    const totalWeek = stats.reduce((s, a) => s + a.total_commits_7d, 0);
    const totalMonth = stats.reduce((s, a) => s + a.total_commits_30d, 0);
    const bestStreak = Math.max(...stats.map((a) => a.current_streak));
    const allRepos = getAllRepos(stats);
    const totalScore = calculateShipScore({
      total_commits_30d: totalMonth,
      total_commits_7d: totalWeek,
      current_streak: bestStreak,
      today_commits: totalToday,
      top_repos: allRepos,
    });

    if (!lastCommitDate) {
      await sendWhatsApp("\u{1F480}\u{1F480}\u{1F480}\n\nAdarsh. 90 days. ZERO commits.\nYour GitHub profile is a graveyard.\n\nYou literally built ShipScore to hold yourself accountable and then stopped shipping.\n\n\u{1F534} Score: 0/1000 \u{1F480} DEAD\n\u{1F3C5} Badges: 0/16 unlocked\n\nOpen your laptop. Push ONE commit. Start the comeback. \u{1F680}");
      return NextResponse.json({ sent: true, reason: "no_commits_at_all" });
    }

    const hoursSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60);

    // Always send daily status if it's the 10 PM IST check
    const message = buildMessage({
      hoursIdle: Math.round(hoursSinceLastCommit),
      score: totalScore,
      streak: bestStreak,
      today: totalToday,
      week: totalWeek,
      month: totalMonth,
      topRepo: allRepos[0]?.name || "unknown",
      repoCount: allRepos.length,
    });

    await sendWhatsApp(message);
    return NextResponse.json({ sent: true, hours_idle: Math.round(hoursSinceLastCommit), score: totalScore });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function getAllRepos(stats: AccountStats[]) {
  const repoMap: Record<string, { name: string; commits: number }> = {};
  for (const a of stats) {
    for (const r of a.top_repos) {
      if (!repoMap[r.full_name]) repoMap[r.full_name] = { name: r.name, commits: r.commits };
      else repoMap[r.full_name].commits += r.commits;
    }
  }
  return Object.values(repoMap).sort((a, b) => b.commits - a.commits);
}

// === PERSONALIZED MESSAGES FOR ADARSH ===

interface MessageCtx {
  hoursIdle: number;
  score: number;
  streak: number;
  today: number;
  week: number;
  month: number;
  topRepo: string;
  repoCount: number;
}

// Badge definitions mirrored from Dashboard for WhatsApp insights
interface BadgeInfo { icon: string; name: string; need: string; check: (c: MessageCtx) => boolean }

const BADGES: BadgeInfo[] = [
  { icon: "\u{1F4A7}", name: "First Blood", need: "1+ commit today", check: (c) => c.today >= 1 },
  { icon: "\u{1F525}", name: "Daily Driver", need: "5+ commits today", check: (c) => c.today >= 5 },
  { icon: "\u26A1", name: "Machine Gun", need: "15+ commits today", check: (c) => c.today >= 15 },
  { icon: "\u{1F4AA}", name: "Weekly Grind", need: "30+ commits/week", check: (c) => c.week >= 30 },
  { icon: "\u{1F43B}", name: "Beast Mode", need: "70+ commits/week", check: (c) => c.week >= 70 },
  { icon: "\u{1F3C6}", name: "Centurion", need: "100+ commits/month", check: (c) => c.month >= 100 },
  { icon: "\u{1F451}", name: "Triple Century", need: "300+ commits/month", check: (c) => c.month >= 300 },
  { icon: "\u{1F4A5}", name: "Hatrick", need: "3-day streak", check: (c) => c.streak >= 3 },
  { icon: "\u{1F5E1}\uFE0F", name: "Week Warrior", need: "7-day streak", check: (c) => c.streak >= 7 },
  { icon: "\u{1F30B}", name: "Unstoppable", need: "14-day streak", check: (c) => c.streak >= 14 },
  { icon: "\u{1F48E}", name: "Mythic Streak", need: "30-day streak", check: (c) => c.streak >= 30 },
  { icon: "\u{1F30D}", name: "Multi-tasker", need: "5+ active repos", check: (c) => c.repoCount >= 5 },
  { icon: "\u{1F3F0}", name: "Empire Builder", need: "10+ active repos", check: (c) => c.repoCount >= 10 },
  { icon: "\u2B50", name: "Rising Star", need: "500+ score", check: (c) => c.score >= 500 },
  { icon: "\u{1F31F}", name: "On Fire", need: "800+ score", check: (c) => c.score >= 800 },
  { icon: "\u{1F3C6}", name: "LEGENDARY", need: "1000 score", check: (c) => c.score >= 1000 },
];

function getBadgeInsight(ctx: MessageCtx): string {
  const earned = BADGES.filter((b) => b.check(ctx));
  const locked = BADGES.filter((b) => !b.check(ctx));
  const total = BADGES.length;

  // Find the closest badge to unlock
  const nextBadges = locked.slice(0, 3);

  const lines: string[] = [];
  lines.push(`\u{1F3C5} *Badges: ${earned.length}/${total} unlocked*`);

  if (earned.length > 0) {
    lines.push(earned.map((b) => `${b.icon}`).join(" "));
  }

  if (nextBadges.length > 0) {
    lines.push("");
    lines.push("\u{1F512} *Next badges to unlock:*");
    for (const b of nextBadges) {
      lines.push(`  ${b.icon} ${b.name} \u2014 ${b.need}`);
    }
  }

  return lines.join("\n");
}

function getScoreGuidelines(ctx: MessageCtx): string {
  const { today, week, month, streak, repoCount, score } = ctx;
  const tips: string[] = [];

  if (today === 0) {
    tips.push("\u{1F534} Push 1 commit \u2192 remove 0.5x decay (instant 2x score boost!)");
  }
  if (streak < 3) {
    tips.push(`\u{1F7E1} ${3 - streak} more day(s) of commits \u2192 unlock streak multiplier`);
  } else if (streak < 7) {
    tips.push(`\u{1F7E0} ${7 - streak} more days \u2192 \u{1F5E1}\uFE0F Week Warrior badge + ${(1 + Math.min((7 - 2) * 0.1, 1.5)).toFixed(1)}x streak multiplier`);
  } else if (streak < 14) {
    tips.push(`\u{1F7E2} ${14 - streak} more days \u2192 \u{1F30B} Unstoppable badge + ${(1 + Math.min((14 - 2) * 0.1, 1.5)).toFixed(1)}x multiplier`);
  } else if (streak < 30) {
    tips.push(`\u{1F535} ${30 - streak} more days \u2192 \u{1F48E} Mythic Streak (diamond badge!)`);
  }

  if (today < 5) {
    tips.push(`\u26A1 ${5 - today} more commits today \u2192 \u{1F525} Daily Driver badge`);
  } else if (today < 15) {
    tips.push(`\u26A1 ${15 - today} more commits today \u2192 \u26A1 Machine Gun badge`);
  }

  if (week < 30) {
    tips.push(`\u{1F4AA} ${30 - week} more this week \u2192 \u{1F4AA} Weekly Grind badge`);
  } else if (week < 70) {
    tips.push(`\u{1F43B} ${70 - week} more this week \u2192 \u{1F43B} Beast Mode badge`);
  }

  if (month < 100) {
    tips.push(`\u{1F3C6} ${100 - month} more this month \u2192 \u{1F3C6} Centurion badge`);
  } else if (month < 300) {
    tips.push(`\u{1F451} ${300 - month} more this month \u2192 \u{1F451} Triple Century (diamond!)`);
  }

  if (repoCount < 5) {
    tips.push(`\u{1F30D} Ship in ${5 - repoCount} more repos \u2192 \u{1F30D} Multi-tasker badge`);
  } else if (repoCount < 10) {
    tips.push(`\u{1F3F0} Ship in ${10 - repoCount} more repos \u2192 \u{1F3F0} Empire Builder badge`);
  }

  if (score < 500) {
    tips.push(`\u2B50 ${500 - score} pts to \u2B50 Rising Star badge`);
  } else if (score < 800) {
    tips.push(`\u{1F31F} ${800 - score} pts to \u{1F31F} On Fire badge`);
  } else if (score < 1000) {
    tips.push(`\u{1F3C6} ${1000 - score} pts to \u{1F3C6} LEGENDARY badge`);
  }

  // Return top 4 most actionable tips
  return tips.slice(0, 4).join("\n");
}

function getScoreTier(score: number): string {
  if (score >= 950) return "\u{1F451} LEGENDARY";
  if (score >= 800) return "\u{1F525} ON FIRE";
  if (score >= 600) return "\u{1F512} LOCKED IN";
  if (score >= 400) return "\u{1F680} SHIPPING";
  if (score >= 200) return "\u{1F321}\uFE0F WARMING UP";
  if (score > 0) return "\u{1F6CB}\uFE0F COASTING";
  return "\u{1F480} DEAD";
}

function buildMessage(ctx: MessageCtx): string {
  const { hoursIdle, score, streak, today, week, month, topRepo, repoCount } = ctx;

  // Shipped today — positive reinforcement
  if (today > 0 && hoursIdle < 12) {
    return buildActiveMessage(ctx);
  }

  // Idle 48h+ — nuclear
  if (hoursIdle >= 48) {
    return [
      `\u{1F480}\u{1F480}\u{1F480}`,
      ``,
      `*Adarsh. ${hoursIdle}h without a single commit.*`,
      ``,
      `\u{1F4CA} *Dashboard:*`,
      `\u{1F534} Score: ${score}/1000 ${getScoreTier(score)}`,
      `\u{1F4A2} Streak: ${streak > 0 ? `${streak}d (dying)` : "DEAD"}`,
      `\u{1F4E6} Repos: ${repoCount} gathering dust`,
      `\u23F0 Idle: ${hoursIdle}h`,
      ``,
      `Your ${month} commits this month mean nothing if you stop now.`,
      `The 0.5x decay is halving everything you built.`,
      ``,
      getBadgeInsight(ctx),
      ``,
      `\u{1F3AF} *What to do RIGHT NOW:*`,
      getScoreGuidelines(ctx),
      ``,
      `\u{1F449} Open *${topRepo}* and push ONE commit.`,
      `That's the minimum. Do it now, Adarsh.`,
    ].join("\n");
  }

  // Idle 24-48h — aggressive
  if (hoursIdle >= 24) {
    return [
      `\u{1F6A8} *${hoursIdle}h idle — ShipScore Alert*`,
      ``,
      streak > 0
        ? `\u26A0\uFE0F Your *${streak}-day streak* is on life support.`
        : `\u274C Streak already broken. Start rebuilding.`,
      ``,
      `\u{1F4CA} *Your Numbers:*`,
      `\u{1F3AF} Score: ${score}/1000 ${getScoreTier(score)}`,
      `\u{1F4C5} Today: 0 commits \u{1F534}`,
      `\u{1F4C6} Week: ${week} | Month: ${month}`,
      `\u{1F4E6} Active repos: ${repoCount}`,
      ``,
      getBadgeInsight(ctx),
      ``,
      `\u{1F3AF} *How to recover your score:*`,
      getScoreGuidelines(ctx),
      ``,
      `\u{1F4A1} *Pro tip:* Even a small fix on *${topRepo}* removes the`,
      `0.5x decay and keeps your multipliers alive.`,
      `Momentum > motivation. Ship now. \u{1F680}`,
    ].join("\n");
  }

  // Idle 12-24h — warning with guidance
  if (streak >= 5) {
    const streakMult = (1 + Math.min(Math.max(0, streak - 2) * 0.1, 1.5)).toFixed(1);
    return [
      `\u{1F525} *Streak Alert — ${streak} days and counting!*`,
      ``,
      `Hey Adarsh, your *${streak}-day streak* is precious.`,
      `That's a *${streakMult}x multiplier* on your score.`,
      `Don't let ${hoursIdle}h of inactivity kill it.`,
      ``,
      `\u{1F4CA} *Tonight's Stats:*`,
      `\u{1F3AF} Score: ${score}/1000 ${getScoreTier(score)}`,
      `\u{1F4C5} Today: ${today} commits ${today === 0 ? "\u{1F534} (decay active!)" : "\u2705"}`,
      `\u{1F4C6} Week: ${week} | Month: ${month}`,
      ``,
      getBadgeInsight(ctx),
      ``,
      `\u{1F3AF} *Next moves to level up:*`,
      getScoreGuidelines(ctx),
      ``,
      `\u{1F449} Push to *${topRepo}* before midnight. Protect the streak. \u{1F6E1}\uFE0F`,
    ].join("\n");
  }

  // Default idle 12-24h message
  return [
    `\u{1F4CB} *ShipScore Daily Report*`,
    ``,
    `Hey Adarsh \u{1F44B}`,
    ``,
    `\u{1F4CA} *Your Numbers:*`,
    `\u{1F3AF} Score: ${score}/1000 ${getScoreTier(score)}`,
    `\u{1F4C5} Today: ${today} commits ${today === 0 ? "\u{1F534}" : "\u2705"}`,
    `\u{1F4C6} Week: ${week} | Month: ${month}`,
    `\u{1F525} Streak: ${streak > 0 ? `${streak}d` : "none \u274C"}`,
    `\u{1F4E6} Repos: ${repoCount} | Top: ${topRepo}`,
    `\u23F0 Idle: ${hoursIdle}h`,
    ``,
    today === 0 ? `\u26A0\uFE0F *Decay active!* Your score is halved without a commit today.` : ``,
    ``,
    getBadgeInsight(ctx),
    ``,
    `\u{1F3AF} *How to boost your score:*`,
    getScoreGuidelines(ctx),
    ``,
    streak < 3
      ? `\u{1F4A1} *Focus:* Build a 3-day streak to unlock the multiplier. That's where the magic starts.`
      : `\u{1F4A1} *Focus:* Keep the streak alive. Every day compounds.`,
    ``,
    `Let's go, Adarsh. Ship something tonight. \u{1F680}`,
  ].join("\n");
}

function buildActiveMessage(ctx: MessageCtx): string {
  const { score, streak, today, week, month, topRepo, repoCount } = ctx;

  if (score >= 800) {
    return [
      `\u{1F525}\u{1F525}\u{1F525} *ADARSH IS ON FIRE* \u{1F525}\u{1F525}\u{1F525}`,
      ``,
      `\u{1F4CA} *Stats:*`,
      `\u{1F3AF} Score: ${score}/1000 ${getScoreTier(score)}`,
      `\u26A1 Today: ${today} commits`,
      `\u{1F525} Streak: ${streak}d ${streak >= 10 ? "(DOUBLE DIGITS \u{1F4AA})" : ""}`,
      `\u{1F4C6} Week: ${week} | Month: ${month}`,
      `\u{1F4E6} Shipping across ${repoCount} repos`,
      ``,
      getBadgeInsight(ctx),
      ``,
      score >= 950
        ? `\u{1F451} *${1000 - score} points to LEGENDARY.* You're RIGHT THERE.`
        : `\u{1F31F} *${1000 - score} pts to LEGENDARY.* Keep this pace.`,
      ``,
      `\u{1F3AF} *Next level moves:*`,
      getScoreGuidelines(ctx),
      ``,
      `This is what a builder looks like. Don't stop. \u{1F680}`,
    ].join("\n");
  }

  return [
    `\u2705 *ShipScore Daily Report*`,
    ``,
    `Nice work today, Adarsh! \u{1F44A}`,
    ``,
    `\u{1F4CA} *Your Numbers:*`,
    `\u{1F3AF} Score: ${score}/1000 ${getScoreTier(score)}`,
    `\u26A1 Today: ${today} commits`,
    `\u{1F525} Streak: ${streak}d`,
    `\u{1F4C6} Week: ${week} | Month: ${month}`,
    `\u{1F4E6} Repos: ${repoCount} | Top: ${topRepo}`,
    ``,
    getBadgeInsight(ctx),
    ``,
    `\u{1F3AF} *Level up tomorrow:*`,
    getScoreGuidelines(ctx),
    ``,
    streak >= 3
      ? `\u{1F4A1} Your streak multiplier is at *${(1 + Math.min(Math.max(0, streak - 2) * 0.1, 1.5)).toFixed(1)}x*. Tomorrow it grows to *${(1 + Math.min(Math.max(0, streak - 1) * 0.1, 1.5)).toFixed(1)}x*. Don't break it!`
      : `\u{1F4A1} *${3 - streak} more day(s)* to unlock the streak multiplier. That's where scores explode.`,
    ``,
    `Keep shipping. \u{1F680}`,
  ].join("\n");
}

async function sendWhatsApp(message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  const to = process.env.TWILIO_WHATSAPP_TO;     // e.g. "whatsapp:+91XXXXXXXXXX"

  if (!accountSid || !authToken || !from || !to) {
    console.log("WhatsApp not configured, would send:", message);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ From: from, To: to, Body: message });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error: ${res.status} ${err}`);
  }
}
