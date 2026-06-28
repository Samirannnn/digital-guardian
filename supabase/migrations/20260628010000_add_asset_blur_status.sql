-- Add is_blurred column to assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS is_blurred BOOLEAN NOT NULL DEFAULT FALSE;
