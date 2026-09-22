-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'swiping', 'matched', 'swiping_r2', 'final')),
  round INTEGER DEFAULT 1,
  match_title_id UUID,
  brief TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preferences (one row per partner per session)
CREATE TABLE IF NOT EXISTS preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  partner TEXT NOT NULL CHECK (partner IN ('A', 'B')),
  mood_tags TEXT[] DEFAULT '{}',
  mood_text TEXT DEFAULT '',
  languages TEXT[] DEFAULT '{}',
  content_type TEXT DEFAULT 'movies',
  min_rating NUMERIC DEFAULT 6,
  era TEXT[] DEFAULT '{}',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, partner)
);

-- Titles fetched for a session (per round)
CREATE TABLE IF NOT EXISTS session_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  round INTEGER DEFAULT 1,
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  rating NUMERIC,
  synopsis TEXT,
  poster_url TEXT,
  ott_platforms JSONB DEFAULT '[]',
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swipes
CREATE TABLE IF NOT EXISTS swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  partner TEXT NOT NULL,
  title_id UUID REFERENCES session_titles(id) ON DELETE CASCADE,
  liked BOOLEAN NOT NULL,
  swiped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, partner, title_id)
);

-- Watch history (post-match ratings)
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title_id UUID REFERENCES session_titles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_swipes_session_title ON swipes(session_id, title_id, liked);
CREATE INDEX IF NOT EXISTS idx_session_titles_session ON session_titles(session_id, round);
CREATE INDEX IF NOT EXISTS idx_preferences_session ON preferences(session_id);

-- Row Level Security (permissive for anonymous sessions)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_preferences" ON preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_titles" ON session_titles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_swipes" ON swipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_history" ON watch_history FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE swipes;
ALTER PUBLICATION supabase_realtime ADD TABLE session_titles;
ALTER PUBLICATION supabase_realtime ADD TABLE preferences;
