# Steam Backlog Planner

A web app that helps you manage and plan your way through your Steam game backlog. Connects to your Steam account, enriches games with data from IGDB and HowLongToBeat, and lets you schedule gaming sessions with optional Discord notifications and Google Calendar sync.

## Features

- **Steam Library Sync** — Import your full Steam library with playtime, achievements, and last played data
- **Game Enrichment** — Automatic genre, rating, and description data from IGDB; time-to-beat estimates from HowLongToBeat
- **Backlog Management** — Categorize games (backlog, playing, completed, abandoned) with drag-and-drop priority sorting
- **Session Scheduling** — Plan gaming sessions with auto-generation based on your availability and backlog priorities
- **Statistics Dashboard** — Playtime analytics, completion predictions, genre breakdowns, and weekly activity charts
- **Discord Notifications** — Webhook-based reminders and session summaries to your Discord channel
- **Google Calendar Sync** — Push scheduled sessions to Google Calendar with automatic create/update/delete
- **Timezone-Aware** — All scheduling respects your configured timezone

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Auth | NextAuth v5 (Steam OpenID) |
| Database | Neon (Postgres) via Drizzle ORM |
| Cache | Upstash Redis |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | TanStack Query + Zustand |
| Testing | Vitest + Playwright + PGlite |

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- An [Upstash](https://upstash.com) Redis instance
- A [Steam API key](https://steamcommunity.com/dev/apikey)

### Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/Tien-Lam/steam-backlog-planner.git
cd steam-backlog-planner
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

3. Push the database schema:

```bash
npm run db:push
```

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Steam.

### Optional Integrations

- **IGDB** — Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from [Twitch Developer Console](https://dev.twitch.tv/console/apps) for game metadata
- **Google Calendar** — Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for calendar sync
- **Discord** — Configure a webhook URL in the app's Settings page for notifications

## Scripts

```bash
npm run dev              # Dev server
npm run build            # Production build
npm test                 # Unit tests
npm run test:coverage    # Unit tests with coverage report
npm run test:integration # Integration tests (PGlite)
npm run test:e2e         # E2E tests (Playwright)
npm run lint             # ESLint
npm run db:push          # Push schema changes to DB
npm run db:studio        # Drizzle Studio (DB browser)
```

## Project Structure

```
src/
  app/
    (dashboard)/         # Authenticated pages (library, schedule, statistics, settings)
    api/                 # API routes (steam, games, sessions, hltb, igdb, google, discord, etc.)
  components/
    games/               # Game cards, backlog prioritizer
    schedule/            # Session calendar, session form
    statistics/          # Charts, predictions, analytics
    settings/            # Discord, Google Calendar, preferences
    ui/                  # shadcn/ui primitives
  lib/
    db/                  # Drizzle schema and client
    hooks/               # TanStack Query hooks
    services/            # Steam, HLTB, IGDB, Google Calendar, Discord, Redis cache
tests/
  integration/           # PGlite-backed integration tests
  e2e/                   # Playwright E2E tests
  live/                  # Live API tests (requires real credentials)
```

## License

MIT
