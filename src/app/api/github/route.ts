import { NextResponse } from "next/server";
import { fetchAccountStats, type GitHubAccount } from "@/lib/github";

export async function GET() {
  const accounts: GitHubAccount[] = [];

  // Work account
  if (process.env.GITHUB_WORK_TOKEN && process.env.GITHUB_WORK_USERNAME) {
    accounts.push({
      username: process.env.GITHUB_WORK_USERNAME,
      label: "Work",
      token: process.env.GITHUB_WORK_TOKEN,
      authorEmail: process.env.GITHUB_WORK_AUTHOR_EMAIL,
      org: process.env.GITHUB_WORK_ORG,
    });
  }

  // Personal account
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
    return NextResponse.json(
      { error: "No GitHub accounts configured. Set GITHUB_WORK_TOKEN/USERNAME and/or GITHUB_PERSONAL_TOKEN/USERNAME env vars." },
      { status: 500 }
    );
  }

  try {
    const stats = await Promise.all(accounts.map(fetchAccountStats));
    return NextResponse.json({ accounts: stats, fetched_at: new Date().toISOString() });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
