-- =========================================================
-- Migration: Global Asset Blur RPC Function
-- =========================================================

-- Function allowing original owner to enforce blur across all duplicate assets with matching hash
CREATE OR REPLACE FUNCTION public.enforce_global_asset_blur(
  p_owner_id UUID,
  p_hash TEXT,
  p_enforce_blur BOOLEAN,
  p_blur_strength INT DEFAULT 20,
  p_blurred_preview_path TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_owner UUID;
BEGIN
  -- Get the original owner of this hash (oldest asset row)
  SELECT user_id INTO v_orig_owner
  FROM public.assets
  WHERE hash = p_hash
  ORDER BY created_at ASC
  LIMIT 1;

  -- Verify caller is the original owner or current owner row
  IF v_orig_owner IS NULL OR (v_orig_owner <> p_owner_id AND NOT EXISTS (SELECT 1 FROM public.assets WHERE hash = p_hash AND user_id = p_owner_id)) THEN
    RETURN FALSE;
  END IF;

  -- Update ALL asset rows sharing this hash across all users
  UPDATE public.assets
  SET
    enforce_blur = p_enforce_blur,
    blur_strength = p_blur_strength,
    blurred_preview_path = COALESCE(p_blurred_preview_path, blurred_preview_path)
  WHERE hash = p_hash;

  RETURN TRUE;
END;
$$;
