-- Hope's Habit Tracker - Supabase Setup Script
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/qrvhezrapxtnojfdgzeu/sql/new

-- 1. Drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS hope_logs CASCADE;

-- 2. Create the table
CREATE TABLE hope_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('walk', 'accident')),
  subtype text CHECK (subtype IN ('pee', 'poop')),
  person text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  duration integer,
  pooped boolean DEFAULT false,
  peed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE hope_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create security policies
CREATE POLICY "Anyone authenticated can read logs"
  ON hope_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own logs"
  ON hope_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = hope_logs.user_id);

CREATE POLICY "Users can update their own logs"
  ON hope_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = hope_logs.user_id);

CREATE POLICY "Users can delete their own logs"
  ON hope_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = hope_logs.user_id);

-- 5. Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE hope_logs;
