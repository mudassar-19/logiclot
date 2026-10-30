
-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
DROP FUNCTION IF EXISTS public.seed_default_channels() CASCADE;

-- Recreate RPC as idempotent
CREATE OR REPLACE FUNCTION public.create_org_and_make_owner(_org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _existing_org uuid;
BEGIN
  SELECT organization_id INTO _existing_org
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF _existing_org IS NOT NULL THEN
    RETURN _existing_org;
  END IF;

  INSERT INTO public.organizations (name, onboarding_completed)
  VALUES (_org_name, true)
  RETURNING id INTO _org_id;

  UPDATE public.profiles
  SET organization_id = _org_id
  WHERE user_id = auth.uid();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'dealer_principal')
  ON CONFLICT DO NOTHING;

  RETURN _org_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
