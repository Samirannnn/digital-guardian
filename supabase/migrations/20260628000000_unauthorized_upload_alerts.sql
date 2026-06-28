-- =========================================================
-- Migration: report_unauthorized_upload RPC function
-- =========================================================

CREATE OR REPLACE FUNCTION public.report_unauthorized_upload(
  p_asset_id UUID,
  p_owner_id UUID,
  p_city TEXT,
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_device TEXT,
  p_app TEXT,
  p_confidence INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the original asset status to 'leaked'
  UPDATE public.assets
  SET status = 'leaked', updated_at = now()
  WHERE id = p_asset_id;

  -- 2. Insert the leak location for the owner
  INSERT INTO public.leak_locations (
    asset_id,
    user_id,
    city,
    lat,
    lon,
    device,
    app,
    confidence,
    detected_at
  ) VALUES (
    p_asset_id,
    p_owner_id,
    p_city,
    p_lat,
    p_lon,
    p_device,
    p_app,
    p_confidence,
    now()
  );

  RETURN TRUE;
END;
$$;
