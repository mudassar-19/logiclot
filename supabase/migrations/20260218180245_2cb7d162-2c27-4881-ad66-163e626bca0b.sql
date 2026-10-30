
-- RPC: create org, link profile, assign dealer_principal role — all in one transaction
-- Drop first to handle parameter rename (org_name -> _org_name)
DROP FUNCTION IF EXISTS public.create_org_and_make_owner(text);
CREATE OR REPLACE FUNCTION public.create_org_and_make_owner(_org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Create the organization
  INSERT INTO public.organizations (name, onboarding_completed)
  VALUES (_org_name, true)
  RETURNING id INTO _org_id;

  -- Link the caller's profile to the new org
  UPDATE public.profiles
  SET organization_id = _org_id
  WHERE user_id = auth.uid();

  -- Assign dealer_principal role (ignore if already exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'dealer_principal')
  ON CONFLICT DO NOTHING;

  RETURN _org_id;
END;
$$;
