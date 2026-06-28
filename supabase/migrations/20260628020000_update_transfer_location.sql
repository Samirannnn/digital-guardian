-- Drop the old accept_transfer_request function signature
DROP FUNCTION IF EXISTS public.accept_transfer_request(request_id UUID);

-- Create updated accept_transfer_request function supporting new owner's location parameters
CREATE OR REPLACE FUNCTION public.accept_transfer_request(
  request_id UUID,
  new_lat DOUBLE PRECISION,
  new_lon DOUBLE PRECISION,
  new_city TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the pending request and ensure the executor is the recipient
  SELECT * INTO req 
  FROM public.transfer_requests 
  WHERE id = request_id AND status = 'pending' AND recipient_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update the request status
  UPDATE public.transfer_requests 
  SET status = 'accepted', updated_at = now() 
  WHERE id = request_id;

  -- Update the asset ownership in public.assets
  UPDATE public.assets 
  SET user_id = req.recipient_id, app_email = req.recipient_email, updated_at = now() 
  WHERE id = req.asset_id;

  -- Update leak_locations associated with this asset so they belong to the new owner
  UPDATE public.leak_locations
  SET user_id = req.recipient_id
  WHERE asset_id = req.asset_id;

  -- Update the primary registry location pin ('Owner Register' or 'Owner Scan') to the new owner's location
  UPDATE public.leak_locations
  SET lat = new_lat, lon = new_lon, city = new_city, detected_at = now()
  WHERE asset_id = req.asset_id AND (device = 'Owner Register' OR device = 'Owner Scan');

  RETURN TRUE;
END;
$$;
