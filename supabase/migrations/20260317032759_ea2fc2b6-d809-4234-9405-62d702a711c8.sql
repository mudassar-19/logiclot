CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  subject text NOT NULL,
  description text NOT NULL,
  page_or_feature text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));