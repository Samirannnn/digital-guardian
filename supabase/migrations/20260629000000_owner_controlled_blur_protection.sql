-- =========================================================
-- Migration: Owner-Controlled Digital Asset Blur Protection (Safe Execution)
-- =========================================================

-- 1. Add enforce_blur, blur_strength, and blurred_preview_path columns to assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS enforce_blur BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blur_strength INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS blurred_preview_path TEXT;

-- 2. Safely synchronize existing is_blurred column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'assets' 
      AND column_name = 'is_blurred'
  ) THEN
    EXECUTE 'UPDATE public.assets SET enforce_blur = is_blurred WHERE is_blurred IS TRUE AND enforce_blur IS FALSE';
  END IF;
END $$;

-- 3. Create protection_audit_logs table
CREATE TABLE IF NOT EXISTS public.protection_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('BLUR_ENABLED', 'BLUR_DISABLED', 'BLUR_STRENGTH_CHANGED')),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user and asset
CREATE INDEX IF NOT EXISTS idx_protection_audit_logs_user ON public.protection_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_protection_audit_logs_asset ON public.protection_audit_logs(asset_id, created_at DESC);

-- Enable RLS on protection_audit_logs
ALTER TABLE public.protection_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for assets they own or actions they performed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own protection audit logs'
  ) THEN
    CREATE POLICY "Users can view own protection audit logs"
      ON public.protection_audit_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own protection audit logs'
  ) THEN
    CREATE POLICY "Users can insert own protection audit logs"
      ON public.protection_audit_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
