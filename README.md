# ShipScore

Track your shipping velocity across multiple GitHub accounts. A gamified commit tracker that motivates you to ship code fast.

**Live**: [ship-score-kappa.vercel.app](https://ship-score-kappa.vercel.app)

## Features

- **Ship Score (0-1000)** — Composite score based on commit volume, velocity, streaks, and repo diversity
- **Multi-account tracking** — Side-by-side comparison of work and personal GitHub activity
- **90-day heatmap** — GitHub-style contribution grid with tap-to-inspect on mobile
- **Top projects** — Ranked repos by commit count with progress bars
- **View toggle** — Switch between All / Work / Personal views
- **Mobile responsive** — Works on any screen size, installable as PWA

## Score Breakdown

| Component | Max Points | How |
|-----------|-----------|-----|
| Volume | 300 | Commits in last 30 days |
| Velocity | 250 | Commits in last 7 days |
| Streak | 200 | Consecutive days with commits |
| Today | 100 | Bonus for shipping today |
| Diversity | 150 | Number of active repos |

## Setup

```bash
git clone https://github.com/Adarsh-Badjate/ship-score.git
cd ship-score
npm install
```

Create `.env.local`:

```env
GITHUB_WORK_USERNAME=your-work-username
GITHUB_WORK_TOKEN=your-token
GITHUB_WORK_AUTHOR_EMAILS=email1@example.com,email2@example.com
GITHUB_WORK_ORG=your-org

GITHUB_PERSONAL_USERNAME=your-personal-username
GITHUB_PERSONAL_TOKEN=your-token
GITHUB_PERSONAL_AUTHOR_EMAILS=email1@example.com,email2@example.com
```

```bash
npm run dev
```

## Deploy

```bash
vercel --prod
```

Set the same env vars in Vercel project settings.

## Tech Stack

- **Next.js 16** with App Router
- **Tailwind CSS** for styling
- **GitHub Search Commits API** for data
- **Vercel** for hosting

## License

MIT
