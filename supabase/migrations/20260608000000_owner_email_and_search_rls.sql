-- =========================================================
-- Migration: configure cross-user read policies on assets & leak_locations
-- =========================================================

-- 1. Drop old single-user SELECT policy and replace with cross-user read
--    (authenticated users can search/scan by hash; RLS still restricts writes)
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;

CREATE POLICY "Authenticated users can view assets"
  ON public.assets FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Same for leak_locations — allow cross-user read for device-count queries
DROP POLICY IF EXISTS "Users can view own leak locations" ON public.leak_locations;

CREATE POLICY "Authenticated users can view leak locations"
  ON public.leak_locations FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Index on hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_assets_hash ON public.assets(hash);
