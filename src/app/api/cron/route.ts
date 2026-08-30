import { NextResponse } from "next/server";
import { fetchAccountStats, type GitHubAccount } from "@/lib/github";

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
          // Set to end of that day (23:59) to be generous
          const d = new Date(day.date + "T23:59:59Z");
          if (!lastCommitDate || d > lastCommitDate) {
            lastCommitDate = d;
          }
          break;
        }
      }
    }

    if (!lastCommitDate) {
      await sendWhatsApp("☠️ You have ZERO commits in 90 days. Your ShipScore is DEAD. Ship something. NOW.");
      return NextResponse.json({ sent: true, reason: "no_commits_at_all" });
    }

    const hoursSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60);
    const totalScore = Math.min(stats.reduce((s, a) => s + a.ship_score, 0), 1000);
    const streak = Math.max(...stats.map((a) => a.current_streak));

    if (hoursSinceLastCommit >= 12) {
      const hours = Math.round(hoursSinceLastCommit);
      const messages = getRottenMessage(hours, totalScore, streak);
      await sendWhatsApp(messages);
      return NextResponse.json({ sent: true, hours_idle: hours, score: totalScore });
    }

    return NextResponse.json({ sent: false, hours_idle: Math.round(hoursSinceLastCommit), score: totalScore });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function getRottenMessage(hoursIdle: number, score: number, streak: number): string {
  // Escalating aggression based on idle time
  if (hoursIdle >= 48) {
    return [
      `💀 ${hoursIdle}h without a commit.`,
      `Your streak is GONE. Score: ${score}/1000.`,
      `At this rate you're a consumer, not a builder.`,
      `Open your laptop and ship something. Anything.`,
    ].join("\n");
  }

  if (hoursIdle >= 24) {
    const streakMsg = streak > 0
      ? `Your ${streak}-day streak is about to DIE.`
      : "You already broke your streak.";
    return [
      `🚨 ${hoursIdle}h idle. ${streakMsg}`,
      `Score: ${score}/1000 and DROPPING.`,
      `Every hour you wait, your multipliers decay.`,
      `One commit. That's all it takes. Ship now.`,
    ].join("\n");
  }

  // 12-24h range
  if (streak >= 5) {
    return [
      `⚠️ ${hoursIdle}h since your last commit.`,
      `You have a ${streak}-day streak on the line.`,
      `Score: ${score}/1000. Don't let it rot.`,
      `Ship something before midnight or lose it all.`,
    ].join("\n");
  }

  return [
    `⏰ ${hoursIdle}h without shipping.`,
    `Score: ${score}/1000. The decay multiplier is eating your points.`,
    `Push a commit to stop the bleeding.`,
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
