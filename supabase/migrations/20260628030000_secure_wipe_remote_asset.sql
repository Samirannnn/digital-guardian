-- Create security definer function to wipe remote duplicate assets
CREATE OR REPLACE FUNCTION public.wipe_remote_asset(
  owner_uid UUID,
  asset_hash TEXT,
  target_lat DOUBLE PRECISION,
  target_lon DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_asset_exists BOOLEAN;
BEGIN
  -- Verify that owner_uid is the actual authorized owner of this hash.
  -- Only the original/current owner's registered asset has status = 'clean'.
  SELECT EXISTS (
    SELECT 1 
    FROM public.assets 
    WHERE hash = asset_hash 
      AND user_id = owner_uid
      AND status = 'clean'
  ) INTO owner_asset_exists;

  IF NOT owner_asset_exists THEN
    -- Executor is not the authorized owner of this asset signature!
    RETURN FALSE;
  END IF;

  -- 1. Delete the owner's specific leak location record at the target coordinates
  DELETE FROM public.leak_locations
  WHERE user_id = owner_uid 
    AND lat = target_lat 
    AND lon = target_lon;

  -- 2. Delete the duplicate asset(s) belonging to other users that have the same hash
  -- (This will cascade delete their leak_locations due to ON DELETE CASCADE references)
  DELETE FROM public.assets
  WHERE hash = asset_hash 
    AND user_id != owner_uid;

  RETURN TRUE;
END;
$$;
