# WatchMatch

Stop scrolling, stop negotiating — find what you both want to watch tonight.

## Setup

### 1. API Keys you'll need

| Service | Where to get it |
|---|---|
| **Supabase** | [supabase.com](https://supabase.com) → New Project → Settings → API |
| **TMDB** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) → Request API Key (free) |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| **RapidAPI** | [rapidapi.com](https://rapidapi.com) → Search "Streaming Availability" → Subscribe to the free tier |

### 2. Supabase database schema

1. Go to your Supabase project → SQL Editor
2. Paste and run the contents of `supabase-schema.sql`
3. Make sure Realtime is enabled for the tables (the schema does this automatically)

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
TMDB_API_KEY=abc123...
RAPIDAPI_KEY=abc123...
```

### 4. Install and run

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` with the Express backend on port 3001.

## How it works

1. **Partner A** opens the app → clicks "Create session" → fills their mood/language preferences → shares the QR code
2. **Partner B** scans the QR → fills their own preferences (privately)
3. Claude reads both preference profiles and generates a TMDB search brief
4. 30 titles are pulled from TMDB and checked for Indian OTT availability
5. Both swipe through the same 30 cards (randomised order) — right to like, left to pass
6. **Match found** → both screens light up simultaneously with the title and exactly where to watch it in India
7. **No match after round 1** → Claude runs a second search based on what each partner actually liked → round 2
8. **Still no match** → top 5 by combined score, decide together

## Tech stack

- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Real-time sync**: Supabase Realtime
- **Database**: Supabase (Postgres)
- **AI**: Claude (Anthropic) for preference → search brief translation
- **Movies**: TMDB API
- **OTT availability**: Streaming Availability API via RapidAPI
- **QR + sharing**: qrcode.react + Web Share API

## OTT platforms covered (India)

Netflix, Amazon Prime Video, Disney+ Hotstar, SonyLIV, ZEE5, JioCinema, Apple TV+, MUBI, YouTube Movies
