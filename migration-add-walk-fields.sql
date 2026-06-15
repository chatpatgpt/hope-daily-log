-- Migration: Add pooped and peed fields for walk tracking
-- Run this in your Supabase SQL Editor

ALTER TABLE hope_logs
ADD COLUMN IF NOT EXISTS pooped boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS peed boolean DEFAULT false;
