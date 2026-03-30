-- Tabela permisiuni per utilizator
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module)
);

-- RLS: doar service_role poate scrie, utilizatorii pot citi propriile permisiuni
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.user_permissions FOR ALL
  USING (true)
  WITH CHECK (true);
