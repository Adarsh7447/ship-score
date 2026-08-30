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
      await sendWhatsApp(pickRandom(ZERO_COMMIT_MSGS));
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

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

const ZERO_COMMIT_MSGS = [
  "Adarsh. 90 days. ZERO commits.\nYour GitHub profile is a graveyard.\nYou built ShipScore to hold yourself accountable.\nOpen the laptop. Ship. NOW.",
  "Bro you literally built a scoring system to track shipping and then stopped shipping.\nThe irony is killing me.\nPush something. Anything.",
];

function buildMessage(ctx: MessageCtx): string {
  const { hoursIdle, score, streak, today, week, month, topRepo, repoCount } = ctx;

  // Shipped today — send a positive reinforcement message
  if (today > 0 && hoursIdle < 12) {
    return buildActiveMessage(ctx);
  }

  // Idle 48h+ — nuclear roast
  if (hoursIdle >= 48) {
    return pickRandom([
      [
        `Adarsh. ${hoursIdle} hours. Not a single commit.`,
        ``,
        `Your streak? Dead.`,
        `Your score? ${score}/1000 and rotting.`,
        `Your ${repoCount} repos are collecting dust.`,
        ``,
        `You were shipping ${month} commits/month. What happened?`,
        `The guy who built ShipScore wouldn't sit idle for ${hoursIdle}h.`,
        `Be that guy again. Open ${topRepo} and push something.`,
      ].join("\n"),
      [
        `${hoursIdle}h idle. Let that sink in.`,
        ``,
        `Score: ${score}/1000`,
        `Streak: ${streak > 0 ? `${streak}d (hanging by a thread)` : "BROKEN"}`,
        `Today: 0 commits`,
        ``,
        `You're not a scroller, Adarsh. You're a builder.`,
        `But builders build. Every day.`,
        `One commit on ${topRepo}. That's the minimum. Go.`,
      ].join("\n"),
    ]);
  }

  // Idle 24-48h — aggressive
  if (hoursIdle >= 24) {
    return pickRandom([
      [
        `Adarsh, ${hoursIdle}h without shipping.`,
        ``,
        streak > 0
          ? `Your ${streak}-day streak is about to snap. You know how long it took to build that.`
          : `You already lost your streak. Don't lose momentum too.`,
        ``,
        `ShipScore: ${score}/1000`,
        `Week: ${week} commits across ${repoCount} repos`,
        `Today: absolutely nothing.`,
        ``,
        `The 0.5x decay multiplier is eating your score alive.`,
        `One push to ${topRepo} fixes everything. Do it now.`,
      ].join("\n"),
      [
        `24+ hours of silence from a guy shipping ${month} commits/month.`,
        ``,
        `Something's off. You okay?`,
        ``,
        `Either way — your score is ${score}/1000 and falling.`,
        streak > 0 ? `${streak}-day streak on the line.` : `Streak already gone.`,
        `The compound multipliers you built up are decaying.`,
        ``,
        `Ship one thing. Even a tiny fix on ${topRepo}.`,
        `Momentum > motivation.`,
      ].join("\n"),
    ]);
  }

  // Idle 12-24h — warning
  if (streak >= 5) {
    return pickRandom([
      [
        `Adarsh, you have a ${streak}-day streak.`,
        `That's ${streak} consecutive days of shipping.`,
        `That streak multiplier is ${(1 + Math.min(Math.max(0, streak - 2) * 0.1, 1.5)).toFixed(1)}x right now.`,
        ``,
        `Don't throw it away for one lazy evening.`,
        ``,
        `Score: ${score}/1000 | ${hoursIdle}h since last commit`,
        `Push to ${topRepo} before midnight.`,
      ].join("\n"),
      [
        `${streak} days straight. ${month} commits this month.`,
        `You're in the zone, Adarsh.`,
        ``,
        `But it's been ${hoursIdle}h since your last push.`,
        `The clock is ticking on that streak.`,
        ``,
        `Score: ${score}/1000`,
        `One commit keeps the fire alive. Ship it.`,
      ].join("\n"),
    ]);
  }

  return pickRandom([
    [
      `ShipScore daily check-in:`,
      ``,
      `Score: ${score}/1000`,
      `Today: ${today} commits`,
      `Week: ${week} | Month: ${month}`,
      `Streak: ${streak > 0 ? `${streak}d` : "none"}`,
      ``,
      `${hoursIdle}h idle. The 0.5x decay is active.`,
      `Your score is literally half of what it could be.`,
      ``,
      `Push one commit to ${topRepo}. That's all.`,
    ].join("\n"),
    [
      `Evening report, Adarsh:`,
      ``,
      `${score}/1000 — ${score < 300 ? "that's rough" : score < 500 ? "mid" : "decent but you can do better"}.`,
      `${hoursIdle}h without shipping.`,
      streak < 3 ? `No streak multiplier active. Need 3+ days.` : `Streak: ${streak}d`,
      ``,
      `The math is simple:`,
      `Ship today → keep multipliers → score goes up.`,
      `Don't ship → 0.5x decay → score bleeds.`,
      ``,
      `Your call. But ${topRepo} is waiting.`,
    ].join("\n"),
  ]);
}

function buildActiveMessage(ctx: MessageCtx): string {
  const { score, streak, today, week, month, topRepo, repoCount } = ctx;

  if (score >= 800) {
    return pickRandom([
      [
        `Adarsh is ON FIRE.`,
        ``,
        `Score: ${score}/1000`,
        `Today: ${today} commits | Streak: ${streak}d`,
        `Week: ${week} | Month: ${month} across ${repoCount} repos`,
        ``,
        `${streak >= 10 ? "Double digit streak. Machine." : ""}`,
        `${score >= 950 ? "You're knocking on LEGENDARY. Keep pushing." : "Keep this pace and LEGENDARY is within reach."}`,
      ].join("\n"),
      [
        `${score}/1000. ${today} commits shipped today.`,
        `${streak}d streak. ${month} this month.`,
        ``,
        `This is what building looks like.`,
        `Don't stop now — ${1000 - score} points to LEGENDARY.`,
      ].join("\n"),
    ]);
  }

  return pickRandom([
    [
      `Daily shipping report:`,
      ``,
      `Score: ${score}/1000`,
      `Today: ${today} | Week: ${week} | Month: ${month}`,
      `Streak: ${streak}d | Repos: ${repoCount}`,
      `Top project: ${topRepo}`,
      ``,
      streak >= 3
        ? `Streak multiplier active at ${(1 + Math.min(Math.max(0, streak - 2) * 0.1, 1.5)).toFixed(1)}x. Every day it grows.`
        : `${3 - streak} more day(s) to unlock the streak multiplier.`,
      ``,
      `Keep building, Adarsh.`,
    ].join("\n"),
    [
      `You shipped ${today} commits today. Not bad.`,
      ``,
      `Score: ${score}/1000`,
      `Streak: ${streak}d`,
      ``,
      `${score < 500 ? "But you're still under 500. Push harder tomorrow." : "Solid day. Stack another one tomorrow."}`,
      `${1000 - score} points to LEGENDARY.`,
    ].join("\n"),
  ]);
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
