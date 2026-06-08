-- =========================================================
-- Migration: Ownership Transfer Workflow with Accept/Reject
-- =========================================================

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- 3. Update handle_new_user trigger function to populate email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- 4. Enable public reading of profiles by email (for authenticated users)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. Create transfer_requests table
CREATE TABLE IF NOT EXISTS public.transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable RLS on transfer_requests
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for transfer_requests
DROP POLICY IF EXISTS "Users can create transfer requests" ON public.transfer_requests;
CREATE POLICY "Users can create transfer requests"
  ON public.transfer_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can view own transfer requests" ON public.transfer_requests;
CREATE POLICY "Users can view own transfer requests"
  ON public.transfer_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Recipients can update transfer requests" ON public.transfer_requests;
CREATE POLICY "Recipients can update transfer requests"
  ON public.transfer_requests FOR UPDATE
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Senders can delete transfer requests" ON public.transfer_requests;
CREATE POLICY "Senders can delete transfer requests"
  ON public.transfer_requests FOR DELETE
  USING (auth.uid() = sender_id);

-- 8. Create security definer function to accept transfer requests (bypasses assets write RLS)
CREATE OR REPLACE FUNCTION public.accept_transfer_request(request_id UUID)
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

  RETURN TRUE;
END;
$$;
